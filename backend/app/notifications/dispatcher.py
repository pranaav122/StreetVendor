"""Claim in short transactions, call providers outside them, then guard each result."""

from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from uuid import uuid4

from sqlalchemy import and_, or_, select

from app.models.accounts import User
from app.models.notifications import DeviceToken, NotificationOutbox
from app.models.visits import RequestEvent, VisitRequest
from app.notifications.provider import ProviderError
from app.notifications.service import live_family

TERMINAL = ("RECEIPT_OK", "FAILED", "SUPPRESSED")


@dataclass
class DispatchResult:
    enabled: bool
    accepted: int = 0
    receipt_ok: int = 0
    retried: int = 0
    suppressed: int = 0
    failed: int = 0


def finish(row, status, now, error=None):
    row.status, row.updated_at, row.last_error_code = status, now, error
    row.lease_until = row.lease_token = None
    row.finished_at = now if status in TERMINAL else None


def claim(factory, now, receipts=False, limit=20):
    pending, leased = (
        ("AWAITING_RECEIPT", "CHECKING_RECEIPT") if receipts else ("PENDING", "SENDING")
    )
    with factory() as session:
        rows = session.scalars(
            select(NotificationOutbox)
            .where(
                or_(
                    and_(
                        NotificationOutbox.status == pending,
                        NotificationOutbox.next_attempt_at <= now,
                    ),
                    and_(
                        NotificationOutbox.status == leased,
                        NotificationOutbox.lease_until <= now,
                    ),
                )
            )
            .order_by(NotificationOutbox.next_attempt_at, NotificationOutbox.id)
            .limit(limit)
            .with_for_update(skip_locked=True)
        ).all()
        claims = []
        for row in rows:
            if not receipts and row.attempts >= 5:
                finish(row, "FAILED", now, "ATTEMPT_LIMIT")
                continue
            row.status = leased
            row.lease_token = uuid4()
            row.lease_until = now + timedelta(seconds=30)
            row.updated_at = now
            if receipts:
                row.receipt_attempts += 1
            else:
                row.attempts += 1
            claims.append((row.id, row.device_token_id, row.lease_token))
        session.commit()
        return claims


def prepare(factory, claim_id, now, receipts=False):
    identifier, device_id, lease_token = claim_id
    with factory() as session:
        row = session.get(NotificationOutbox, identifier)
        device = session.get(DeviceToken, device_id)
        if row is None or row.lease_token != lease_token:
            return None
        user = session.get(User, row.recipient_user_id)
        valid = (
            device is not None
            and user is not None
            and user.status == "ACTIVE"
            and device.user_id == row.recipient_user_id
        )
        valid = (
            valid
            and device.disabled_at is None
            and user.role == device.app_kind
            and live_family(session, user.id, device.session_family_id, now)
        )
        error = "DEVICE_UNAVAILABLE" if not valid else None
        event = session.get(RequestEvent, row.request_event_id)
        visit = session.get(VisitRequest, event.request_id) if event else None
        if not receipts and (
            event is None
            or visit is None
            or visit.version != event.request_version
            or now - row.created_at > timedelta(minutes=5)
        ):
            error = "OBSOLETE_EVENT"
        if error:
            finish(row, "SUPPRESSED", now, error)
            session.commit()
            return {"suppressed": True}
        if receipts and now - row.created_at > timedelta(hours=24):
            finish(row, "FAILED", now, "RECEIPT_TIMEOUT")
            session.commit()
            return {"failed": True}
        body = (
            "சந்திப்பு புதுப்பிக்கப்பட்டது. தற்போதைய விவரங்களை செயலியில் பார்க்கவும்."
            if user.preferred_language == "ta"
            else "A visit was updated. Open the app for current details."
        )
        return {
            "claim": claim_id,
            "project_id": device.project_id,
            "ticket_id": row.provider_ticket_id,
            "message": {
                "to": device.token,
                "title": "MyStreetVendor",
                "body": body,
                "sound": "default",
                "ttl": max(1, int(300 - (now - row.created_at).total_seconds())),
                "data": dict(row.payload),
            },
        }


def record(factory, claim_id, now, result=None, error=None, receipts=False):
    identifier, device_id, lease_token = claim_id
    with factory() as session:
        # Ownership transfers lock devices before deleting delivery rows. Keep that order here too.
        device = session.scalar(
            select(DeviceToken).where(DeviceToken.id == device_id).with_for_update()
        )
        row = session.scalar(
            select(NotificationOutbox)
            .where(NotificationOutbox.id == identifier)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if (
            row is None
            or row.lease_token != lease_token
            or device is None
            or row.recipient_user_id != device.user_id
        ):
            return "ignored"
        if error is None and result and result.get("status") == "ok":
            if receipts:
                finish(row, "RECEIPT_OK", now)
                outcome = "receipt_ok"
            elif isinstance(result.get("id"), str) and 1 <= len(result["id"]) <= 128:
                row.provider_ticket_id = result["id"]
                finish(row, "AWAITING_RECEIPT", now)
                row.next_attempt_at = now + timedelta(minutes=15)
                outcome = "accepted"
            else:
                error = ProviderError("INVALID_TICKET")
        elif error is None and receipts and result is None:
            finish(row, "AWAITING_RECEIPT", now)
            row.next_attempt_at = now + timedelta(minutes=15)
            outcome = "retried"
        elif error is None:
            details = result.get("details", {}) if isinstance(result, dict) else {}
            code = details.get("error") if isinstance(details, dict) else None
            codes = {
                "DeviceNotRegistered",
                "MessageTooBig",
                "MessageRateExceeded",
                "MismatchSenderId",
                "InvalidCredentials",
            }
            code = code if code in codes else "PROVIDER_ERROR"
            error = ProviderError(
                code, code in ("MessageRateExceeded", "PROVIDER_ERROR")
            )
        if error is not None:
            retry = error.retryable and (receipts or row.attempts < 5)
            if error.code == "DeviceNotRegistered":
                device.disabled_at = device.updated_at = now
            if retry:
                finish(
                    row, "AWAITING_RECEIPT" if receipts else "PENDING", now, error.code
                )
                row.next_attempt_at = now + timedelta(
                    seconds=900 if receipts else min(900, 5 * 2 ** (row.attempts - 1))
                )
                outcome = "retried"
            else:
                finish(row, "FAILED", now, error.code)
                outcome = "failed"
        session.commit()
        return outcome


def send_group(provider, messages):
    try:
        return provider.send(messages)
    except ProviderError as error:
        if error.code != "HTTP_400" or len(messages) == 1:
            raise

    # Isolate malformed addresses so one installation cannot block its neighbours.
    # Bound concurrent calls; no database transaction stays open during network I/O.
    def send_one(message):
        try:
            response = provider.send([message])
            if not isinstance(response, list) or len(response) != 1:
                return ProviderError("INVALID_RESPONSE")
            return response[0]
        except ProviderError as error:
            return error
        except (TimeoutError, OSError):
            return ProviderError("TRANSPORT_UNAVAILABLE")

    with ThreadPoolExecutor(max_workers=4) as executor:
        return list(executor.map(send_one, messages))


def dispatch_batch(factory, provider, now):
    result = DispatchResult(enabled=provider.enabled)
    if not provider.enabled:
        return result
    for receipts in (False, True):
        groups = {}
        for claim_id in claim(factory, now, receipts):
            prepared = prepare(factory, claim_id, now, receipts)
            if not prepared:
                continue
            if prepared.get("suppressed"):
                result.suppressed += 1
                continue
            if prepared.get("failed"):
                result.failed += 1
                continue
            groups.setdefault(prepared["project_id"], []).append(prepared)
        for group in groups.values():
            error = None
            try:
                if receipts:
                    responses = provider.receipts([item["ticket_id"] for item in group])
                    responses = [responses.get(item["ticket_id"]) for item in group]
                else:
                    responses = send_group(
                        provider, [item["message"] for item in group]
                    )
                if not isinstance(responses, list) or len(responses) != len(group):
                    raise ProviderError("INVALID_RESPONSE")
            except ProviderError as failure:
                error = failure
            except (TimeoutError, OSError):
                error = ProviderError("TRANSPORT_UNAVAILABLE")
            if error:
                responses = [None] * len(group)
            for item, response in zip(group, responses):
                item_error = response if isinstance(response, ProviderError) else error
                if isinstance(response, ProviderError):
                    response = None
                outcome = record(
                    factory, item["claim"], now, response, item_error, receipts
                )
                if outcome != "ignored":
                    setattr(result, outcome, getattr(result, outcome) + 1)
    return result

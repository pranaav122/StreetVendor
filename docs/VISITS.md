# Visit requests, privacy and maintenance

A visit means a requested meeting with a vendor. Completing one records no purchase, price or sale.

Customers create requests using a UUID `Idempotency-Key`. Retrying the same validated body returns the same request; changing its body requires a new key. A partial unique database index prevents two active requests between the same customer and vendor. Creation holds the vendor lock while checking availability and capacity. Each vendor can have at most 100 active visits by default, bounding the work performed for one GPS fix. The limit can be lowered with `VENDOR_ACTIVE_REQUEST_LIMIT`.

Requests begin `PENDING` and expire after five minutes. The target vendor can accept or decline, and either participant can cancel. Acceptance sets a new deadline 60 minutes ahead. The vendor can mark an accepted visit `APPROACHING`; the server can also do so when accurate fresh GPS is within 500 metres. Only the server marks `ARRIVED`. The vendor can complete an arrived visit. Cancellation and expiry also apply to accepted, approaching and arrived visits. Terminal requests cannot be reopened.

Every transition checks `expected_version`, locks the request, increments its version and appends one event in the same transaction. A competing action returns `REQUEST_STATE_CONFLICT`; refetch state before deciding what to do next. A failed event insert rolls back the state change. A deadline encountered during a read or write records expiry before returning a conflict. Staff cancellation requires a separate audited route; customers can still cancel when the vendor account has been suspended.

## Arrival and tracking

Arrival needs two usable fixes within 50 metres, with accuracy at most 30 metres and age at most 30 seconds. Both capture times and server receipt times must be at least five seconds apart. Future timestamps cannot establish elapsed time. A poor or outside fix resets the candidate. Stopping and resuming sharing starts a new period; restarting the API safely loses the candidate and requires new fixes.

Only the request's customer can read the vendor's exact position through `/api/v1/requests/{id}/vendor-location`, and only during an unexpired accepted, approaching or arrived visit. Every read checks current vendor/account status, consent, availability and freshness. Other users receive `REQUEST_NOT_FOUND`; an authorized customer receives `TRACKING_UNAVAILABLE` when the visit or location no longer qualifies. Discovery stays coarse throughout.

Meeting points and labels are private to request participants and authorized staff. Staff request inspection records an audit entry. Account deletion cancels active visits and immediately erases associated meeting points and labels. Normal cleanup erases terminal points within 24 hours and purges minimal visit/event/report history after 90 days. Event metadata contains no coordinates, meeting labels or free-text report reasons.

## Reports and jobs

A participant may submit one report per visit, with a safety/no-show/other category and a bounded reason. Only staff can inspect the queue or resolve reports. Resolution and its audit record commit together. Reports follow their parent visit's retention policy.

The single API process runs bounded expiry and retention batches when `JOBS_ENABLED=true`. Development Compose enables this; host Python can use the example environment setting. Tests disable workers unless they are testing the worker itself. Shutdown signals the loop and waits for its current bounded database work before disposing the pool. The notification dispatcher is added in the next backend package.

## Where to debug

| File | Responsibility |
|---|---|
| `app/visits/router.py` | HTTP inputs and server-derived actor |
| `app/visits/state.py` | Allowed actions and terminal states |
| `app/visits/service.py` | Idempotency, locks, versions, deadlines, events and scoped history |
| `app/visits/arrival.py` | Two-observation arrival check and transient candidates |
| `app/visits/tracking.py` | Exact-point authorization and live eligibility |
| `app/visits/privacy.py` | Cancellation and immediate erasure on account deletion |
| `app/visits/reports.py` | Participant reports and audited staff resolution |
| `app/models/visits.py`, `app/models/reports.py` | Database constraints and relationships |
| `migrations/versions/0005_visits_reports.py` | Explicit database upgrade and reverse order for rollback |
| `app/jobs.py` | Bounded expiry, redaction and purge |

Start with the HTTP error category and current version. Inspect event versions for that request, then its deadline and vendor availability. Use synthetic coordinates in debugging. Do not copy tokens, meeting points or report text into shared logs. Realtime and push delivery are subsequent packages; a successful REST transition does not yet prove either transport.

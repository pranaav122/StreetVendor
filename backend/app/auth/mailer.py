"""SMTP transport; construction never connects or sends mail."""

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.config import Settings

logger = logging.getLogger(__name__)


class SMTPMailer:
    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def enabled(self) -> bool:
        s = self.settings
        credentials_complete = bool(s.smtp_username) == bool(s.smtp_password)
        # Cleartext SMTP is permitted only for the local development inbox.
        secure = s.environment != "production" or s.smtp_ssl or s.smtp_starttls
        return bool(s.smtp_host and s.smtp_from and credentials_complete and secure)

    def send(self, recipient: str, subject: str, body: str) -> None:
        s = self.settings
        if not self.enabled:
            raise RuntimeError("Mail is not configured")
        message = EmailMessage()
        message["From"], message["To"], message["Subject"] = str(s.smtp_from), recipient, subject
        message.set_content(body)
        context = ssl.create_default_context()
        transport = smtplib.SMTP_SSL if s.smtp_ssl else smtplib.SMTP
        options = {"context": context} if s.smtp_ssl else {}
        with transport(s.smtp_host, s.smtp_port, timeout=5, **options) as connection:
            if s.smtp_starttls and not s.smtp_ssl:
                connection.starttls(context=context)
            if s.smtp_username:
                connection.login(s.smtp_username, s.smtp_password.get_secret_value())
            connection.send_message(message)


def send_safely(mailer, recipient: str, subject: str, body: str) -> None:
    try:
        mailer.send(recipient, subject, body)
    except (smtplib.SMTPException, OSError) as error:
        # Transport errors can contain addresses or secrets: log the class only.
        logger.warning("Mail delivery failed: %s", type(error).__name__)

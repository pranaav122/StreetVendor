import pytest
from pydantic import ValidationError

from app.auth.schemas import RegisterInput


def test_password_shorter_than_fifteen_characters_is_rejected():
    with pytest.raises(ValidationError):
        RegisterInput(email="person@example.com", password="x" * 14, display_name="Person")


def test_password_spaces_and_unicode_are_preserved():
    raw = "  a-long-passphrase-é-🌿  "
    payload = RegisterInput(email="person@example.com", password=raw, display_name="Person")
    assert payload.password.get_secret_value() == raw


def test_invalid_unicode_password_is_a_validation_error():
    with pytest.raises(ValidationError):
        RegisterInput(email="person@example.com", password="x" * 15 + "\ud800", display_name="Person")

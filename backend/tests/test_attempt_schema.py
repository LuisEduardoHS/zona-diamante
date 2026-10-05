import pytest
from pydantic import ValidationError

from app.schemas.attempt import AttemptCreate


def test_attempt_metadata_rejects_oversized_payload():
    with pytest.raises(ValidationError):
        AttemptCreate(
            activity_type="trivia",
            metadata={
                "data": "x" * (17 * 1024)
            },
        )
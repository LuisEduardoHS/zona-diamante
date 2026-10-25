import pytest

from checks.phase01_database import CheckFailure, check_tap


def test_tap_accepts_a_complete_successful_plan():
    assert check_tap("ok 1 - purchase\nok 2 - retry\n1..2\n") == 2


@pytest.mark.parametrize("output", [
    "ok 1 - purchase\nnot ok 2 - double debit\n1..2\n",
    "ok 1 - purchase\n",  # aborted before finish()
    "1..0 # SKIP no database\n",
    "ok 1 - skipped # SKIP unavailable extension\n1..1\n",
    "ok 1 - future # TODO implement concurrency\n1..1\n",
    "ok 1 - duplicate\nok 1 - duplicate\n1..2\n",
    "ok 1 - partial\n1..2\n",
    "Bail out!\n",
])
def test_tap_never_counts_failures_skips_or_incomplete_output_as_success(output):
    with pytest.raises(CheckFailure):
        check_tap(output)

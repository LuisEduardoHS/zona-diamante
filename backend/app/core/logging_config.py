import logging

from app.core.config import settings


LOGGER_NAME = "zona_diamante"


def configure_logging() -> None:
    logger = logging.getLogger(LOGGER_NAME)

    level = getattr(
        logging,
        settings.log_level.upper(),
        logging.INFO,
    )

    logger.setLevel(level)

    if logger.handlers:
        return

    handler = logging.StreamHandler()

    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s | %(levelname)s | "
            "%(name)s | %(message)s"
        )
    )

    logger.addHandler(handler)
    logger.propagate = False
import logging
from logging.config import dictConfig


LOGGING_CONFIG = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'structured': {
            'format': 'time=%(asctime)s level=%(levelname)s logger=%(name)s message=%(message)s'
        }
    },
    'handlers': {
        'default': {
            'class': 'logging.StreamHandler',
            'formatter': 'structured',
        }
    },
    'root': {'level': 'INFO', 'handlers': ['default']},
}


def setup_logging() -> None:
    dictConfig(LOGGING_CONFIG)
    logging.getLogger(__name__).info('logging_configured')

from functools import lru_cache

from sqlalchemy import Engine, create_engine

from app.config import get_settings


@lru_cache
def get_engine() -> Engine:
    """Create the database engine only when a database feature needs it."""
    return create_engine(get_settings().database_url, pool_pre_ping=True)


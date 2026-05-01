from collections.abc import Generator

import pymysql
from pymysql.connections import Connection

from .config import get_settings

settings = get_settings()


def get_connection(database: str | None = None) -> Connection:
    return pymysql.connect(
        host=settings.mysql_host,
        port=settings.mysql_port,
        user=settings.mysql_user,
        password=settings.mysql_password,
        database=database or settings.mysql_database,
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
        charset="utf8mb4",
    )


def get_db() -> Generator[Connection, None, None]:
    db = get_connection()
    try:
        yield db
    finally:
        db.close()

# db.py
import sqlite3
from flask import g

import os
DATABASE = os.path.join(os.path.dirname(__file__), 'db_widgets.db')


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


def close_db(e=None):
    db = g.pop("db", None)

    if db is not None:
        db.close()


def init_db(app):
    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions';"
    )

    if cursor.fetchone() is None:
        with app.app_context():
            with app.open_resource("db_schema.sql", mode="r") as f:
                db.executescript(f.read())
    db.commit()

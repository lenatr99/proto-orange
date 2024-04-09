DROP TABLE IF EXISTS sessions;
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    UNIQUE(session_id)
);

DROP TABLE IF EXISTS widgets;
CREATE TABLE widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    widget_id TEXT NOT NULL,
    settings TEXT,
    FOREIGN KEY(session_id) REFERENCES sessions(session_id)
);

DROP TABLE IF EXISTS connections;
CREATE TABLE connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES sessions(session_id)
);

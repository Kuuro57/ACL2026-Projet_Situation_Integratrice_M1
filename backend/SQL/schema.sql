-- Schema d'initialisation pour une nouvelle base better-sqlite3

CREATE TABLE user (
  id TEXT PRIMARY KEY NOT NULL, -- UUID genere par le serveur
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  password_hash TEXT NOT NULL
);

CREATE TABLE calendar (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE permissionType (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL UNIQUE
);

CREATE TABLE calendarUser (
  calendar_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  permission_id INTEGER NOT NULL,
  PRIMARY KEY (calendar_id, user_id),
  FOREIGN KEY (calendar_id) REFERENCES calendar(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissionType(id) ON DELETE RESTRICT
);

CREATE TABLE logs (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  description TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Un utilisateur ayant des logs ne peut pas etre supprime directement.
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE RESTRICT
);

CREATE TABLE history2Calendar (
  logs_id INTEGER NOT NULL,
  calendar_id INTEGER NOT NULL,
  PRIMARY KEY (logs_id, calendar_id),
  FOREIGN KEY (logs_id) REFERENCES logs(id) ON DELETE CASCADE,
  FOREIGN KEY (calendar_id) REFERENCES calendar(id) ON DELETE CASCADE
);

CREATE TABLE event (
  id INTEGER PRIMARY KEY,
  start TEXT NOT NULL, -- Date et heure format ISO 8601 UTC
  duration INTEGER NOT NULL, -- Duree entiere en minutes
  title TEXT NOT NULL,
  description TEXT,
  reminderTime INTEGER -- Minutes avant le debut, NULL = aucun rappel
);

CREATE TABLE frequency (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL UNIQUE
);

CREATE TABLE eventTag (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL UNIQUE
);

CREATE TABLE eventTag2Event (
  tag_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  PRIMARY KEY (tag_id, event_id),
  FOREIGN KEY (tag_id) REFERENCES eventTag(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
);

CREATE TABLE frequency2Event (
  frequency_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  repeat_interval INTEGER NOT NULL DEFAULT 1,
  repeat_until TEXT, -- Derniere limite de recurrence en ISO UTC ; NULL = sans fin
  time_zone TEXT NOT NULL DEFAULT 'UTC'
  PRIMARY KEY (frequency_id, event_id),
  FOREIGN KEY (frequency_id) REFERENCES frequency(id) ON DELETE RESTRICT,
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
);

CREATE TABLE calendar2Event (
  calendar_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  PRIMARY KEY (calendar_id, event_id),
  FOREIGN KEY (calendar_id) REFERENCES calendar(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
);

CREATE TABLE session (
  token_hash TEXT PRIMARY KEY NOT NULL, -- Hash SHA-256 du jeton, jamais le jeton brut
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT, -- NULL tant que la session n'a pas ete revoquee
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

INSERT INTO frequency (label) VALUES ('seconde'), ('minute'), ('heure'), ('jour'), ('semaine'), ('mois'), ('annee');

INSERT INTO permissionType (label) VALUES ('proprietaire'), ('visiteur'), ('editeur');

-- Paperly RSVP — initial D1 schema.
--
-- Apply locally:   npm run db:migrate:local
-- Apply to prod:   npm run db:migrate
-- (both run `wrangler d1 migrations apply paperly-rsvp ...`)
--
-- Both tables carry `site_id` and `language` so a single database can safely
-- hold submissions for every client site you deploy. `created_at` defaults to
-- the UTC timestamp at insert time.

CREATE TABLE IF NOT EXISTS rsvps (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id      TEXT    NOT NULL,
  language     TEXT,
  full_name    TEXT    NOT NULL,
  email        TEXT,
  phone        TEXT,
  attending    TEXT    NOT NULL,           -- 'yes' or 'no'
  guests       INTEGER DEFAULT 0,
  guest_names  TEXT,
  dietary      TEXT,                        -- dietary restrictions / kashrut notes
  message      TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rsvps_site ON rsvps (site_id, created_at);

CREATE TABLE IF NOT EXISTS contact_messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id      TEXT    NOT NULL,
  language     TEXT,
  name         TEXT    NOT NULL,
  email        TEXT,
  message      TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contact_site ON contact_messages (site_id, created_at);

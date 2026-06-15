-- Paperly control panel: sites live in the database now (no more static
-- per-client builds). One hosted app renders any site from this table.
--
-- Apply:  npm run db:migrate        (remote)
--         npm run db:migrate:local  (local dev)

CREATE TABLE IF NOT EXISTS sites (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,          -- e.g. "smith-wedding" → /s/smith-wedding
  title       TEXT    NOT NULL,
  -- lifecycle: 'building' (draft) | 'active' (live) | 'paused' | 'archived'
  status      TEXT    NOT NULL DEFAULT 'building',
  domain      TEXT,                              -- optional custom domain, e.g. smithwedding.com
  content     TEXT    NOT NULL,                  -- content.json as text
  theme       TEXT    NOT NULL,                  -- theme.json as text
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sites_status ON sites (status);
CREATE INDEX IF NOT EXISTS idx_sites_domain ON sites (domain);

-- Submissions can now belong to a specific RSVP block (e.g. wedding vs henna).
ALTER TABLE rsvps ADD COLUMN block_id TEXT;
ALTER TABLE rsvps ADD COLUMN event_label TEXT;

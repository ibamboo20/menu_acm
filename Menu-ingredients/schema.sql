-- One row holds the whole shared document. The version column is what makes
-- concurrent edits safe: a write only lands if it was based on the version
-- that is still current (see worker.js).
CREATE TABLE IF NOT EXISTS app_state (
  id      INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL,
  state   TEXT    NOT NULL
);

INSERT OR IGNORE INTO app_state (id, version, state)
VALUES (1, 0, '{"menus":[],"ingredients":[],"sauces":[],"beverages":[],"drinks":[]}');

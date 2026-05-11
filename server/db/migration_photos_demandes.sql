-- Migration : photos jointes aux demandes d'intervention
-- Prérequis : créer dans Supabase Storage un bucket PUBLIC nommé "demandes-photos"
-- (Storage → New bucket → Name: demandes-photos → Public: ✓)

CREATE TABLE IF NOT EXISTS demandes_intervention_photos (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_id   UUID         NOT NULL REFERENCES demandes_intervention(id) ON DELETE CASCADE,
  storage_path TEXT         NOT NULL,
  url          TEXT         NOT NULL,
  nom          VARCHAR(255),
  taille       INTEGER,
  type_mime    VARCHAR(100),
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photos_demande_id
  ON demandes_intervention_photos(demande_id, created_at);

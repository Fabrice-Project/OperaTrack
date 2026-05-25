-- Migration : Feux tricolores et armoires dédiées
-- À exécuter dans l'éditeur SQL Supabase

-- ── Table armoires_feux ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS armoires_feux (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  intitule       TEXT          NOT NULL UNIQUE,
  localisation   TEXT,
  latitude       NUMERIC(10,7),
  longitude      NUMERIC(10,7),
  type_controleur TEXT,
  marque         TEXT,
  modele         TEXT,
  numero_serie   TEXT,
  annee_pose     INTEGER,
  commentaire    TEXT,
  created_at     TIMESTAMPTZ   DEFAULT now()
);

-- ── Table feux_tricolores ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feux_tricolores (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reference    TEXT          NOT NULL,
  armoire_id   UUID          REFERENCES armoires_feux(id) ON DELETE SET NULL,
  localisation TEXT,
  latitude     NUMERIC(10,7),
  longitude    NUMERIC(10,7),
  type_feu     TEXT          DEFAULT 'vehicule'    CHECK (type_feu   IN ('vehicule','pieton','velo','tram')),
  nb_feux      INTEGER       DEFAULT 3,
  technologie  TEXT          DEFAULT 'led'         CHECK (technologie IN ('led','incandescent','autre')),
  annee_pose   INTEGER,
  etat_general TEXT          DEFAULT 'fonctionnel' CHECK (etat_general IN ('fonctionnel','defaillant','hors_service','en_travaux')),
  commentaire  TEXT,
  created_at   TIMESTAMPTZ   DEFAULT now()
);

-- ── Contrainte UNIQUE sur reference (nécessaire pour l'import Excel/upsert) ──
ALTER TABLE feux_tricolores ADD CONSTRAINT feux_tricolores_reference_key UNIQUE (reference);

-- ── RLS (Row Level Security) — mêmes règles qu'éclairage ─────────────────────
ALTER TABLE armoires_feux   ENABLE ROW LEVEL SECURITY;
ALTER TABLE feux_tricolores ENABLE ROW LEVEL SECURITY;

-- Politiques : service_role bypass (supabaseAdmin), authentifiés en lecture
CREATE POLICY "armoires_feux_read"   ON armoires_feux   FOR SELECT USING (true);
CREATE POLICY "armoires_feux_write"  ON armoires_feux   FOR ALL    USING (true);
CREATE POLICY "feux_tricolores_read" ON feux_tricolores FOR SELECT USING (true);
CREATE POLICY "feux_tricolores_write"ON feux_tricolores FOR ALL    USING (true);

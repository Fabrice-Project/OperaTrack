-- ============================================================
-- Migration : Documents et répertoires pour les bâtiments
-- OpéraTrack — Gestion patrimoniale
-- ============================================================

-- Répertoires (dossiers) liés à un bâtiment
CREATE TABLE IF NOT EXISTS repertoires_batiment (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batiment_id UUID NOT NULL REFERENCES batiments(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES repertoires_batiment(id) ON DELETE CASCADE,
  nom         VARCHAR(200) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rep_bat_batiment ON repertoires_batiment(batiment_id);
CREATE INDEX IF NOT EXISTS idx_rep_bat_parent   ON repertoires_batiment(parent_id);

-- Documents rattachés à un bâtiment (optionnellement dans un répertoire)
CREATE TABLE IF NOT EXISTS documents_batiment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batiment_id     UUID NOT NULL REFERENCES batiments(id) ON DELETE CASCADE,
  repertoire_id   UUID REFERENCES repertoires_batiment(id) ON DELETE SET NULL,
  nom_fichier     VARCHAR(255) NOT NULL,
  nom_affichage   VARCHAR(255) NOT NULL,
  description     TEXT,
  taille_octets   BIGINT,
  type_mime       VARCHAR(100),
  storage_path    VARCHAR(500) NOT NULL,
  uploaded_by     UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doc_bat_batiment   ON documents_batiment(batiment_id);
CREATE INDEX IF NOT EXISTS idx_doc_bat_repertoire ON documents_batiment(repertoire_id);

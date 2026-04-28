-- ============================================================
-- OpéraTrack — Migration Phase 3 : Planning & GED
-- ============================================================

-- ── TABLE JALONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jalons (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  intitule     VARCHAR(255) NOT NULL,
  ordre        INTEGER NOT NULL DEFAULT 0,
  date_prevue  DATE,
  date_reelle  DATE,
  commentaire  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jalons_operation ON jalons(operation_id);
CREATE INDEX IF NOT EXISTS idx_jalons_ordre     ON jalons(operation_id, ordre);

CREATE OR REPLACE FUNCTION update_jalons_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jalons_updated_at ON jalons;
CREATE TRIGGER trg_jalons_updated_at
  BEFORE UPDATE ON jalons FOR EACH ROW EXECUTE FUNCTION update_jalons_updated_at();

ALTER TABLE jalons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jalons_select" ON jalons FOR SELECT USING (true);
CREATE POLICY "jalons_insert" ON jalons FOR INSERT WITH CHECK (true);
CREATE POLICY "jalons_update" ON jalons FOR UPDATE USING (true);
CREATE POLICY "jalons_delete" ON jalons FOR DELETE USING (true);

-- ── TABLE CATÉGORIES DOCUMENTS ───────────────────────────────
CREATE TABLE IF NOT EXISTS categories_documents (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  libelle VARCHAR(100) NOT NULL,
  icone   VARCHAR(50),
  ordre   INTEGER
);

INSERT INTO categories_documents (libelle, icone, ordre) VALUES
  ('Études et diagnostics',          'FileSearch',     1),
  ('DCE / CCTP',                     'FileText',       2),
  ('Marchés et contrats',            'FileSignature',  3),
  ('Procès-verbaux',                 'ClipboardCheck', 4),
  ('Courriers et échanges',          'Mail',           5),
  ('Photos et plans',                'Image',          6),
  ('DOE / Dossier ouvrage exécuté',  'Archive',        7),
  ('Financements et subventions',    'Banknote',       8),
  ('Autres',                         'File',           9)
ON CONFLICT DO NOTHING;

-- ── TABLE DOCUMENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id      UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  categorie_id      UUID REFERENCES categories_documents(id),
  nom_fichier       VARCHAR(255) NOT NULL,
  nom_affichage     VARCHAR(255) NOT NULL,
  description       TEXT,
  version           INTEGER NOT NULL DEFAULT 1,
  fichier_parent_id UUID REFERENCES documents(id),
  taille_octets     BIGINT,
  type_mime         VARCHAR(100),
  storage_path      VARCHAR(500) NOT NULL,
  uploaded_by       UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_operation ON documents(operation_id);
CREATE INDEX IF NOT EXISTS idx_documents_categorie ON documents(categorie_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_select" ON documents FOR SELECT USING (true);
CREATE POLICY "documents_insert" ON documents FOR INSERT WITH CHECK (true);
CREATE POLICY "documents_update" ON documents FOR UPDATE USING (true);
CREATE POLICY "documents_delete" ON documents FOR DELETE USING (true);

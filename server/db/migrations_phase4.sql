-- ============================================================
-- OpéraTrack — Migration Phase 4 : Réception, Résilience, Mandat
-- ============================================================

-- ── CHAMPS SUPPLÉMENTAIRES SUR OPERATIONS ───────────────────
ALTER TABLE operations ADD COLUMN IF NOT EXISTS doe_date_remise DATE;

ALTER TABLE operations ADD COLUMN IF NOT EXISTS resilience_v1 VARCHAR(20) DEFAULT 'non_renseigne'
  CHECK (resilience_v1 IN ('non_renseigne', 'non_concerne', 'partiel', 'significatif', 'structurant'));
ALTER TABLE operations ADD COLUMN IF NOT EXISTS resilience_v2 VARCHAR(20) DEFAULT 'non_renseigne'
  CHECK (resilience_v2 IN ('non_renseigne', 'non_concerne', 'partiel', 'significatif', 'structurant'));
ALTER TABLE operations ADD COLUMN IF NOT EXISTS resilience_v3 VARCHAR(20) DEFAULT 'non_renseigne'
  CHECK (resilience_v3 IN ('non_renseigne', 'non_concerne', 'partiel', 'significatif', 'structurant'));
ALTER TABLE operations ADD COLUMN IF NOT EXISTS resilience_v4 VARCHAR(20) DEFAULT 'non_renseigne'
  CHECK (resilience_v4 IN ('non_renseigne', 'non_concerne', 'partiel', 'significatif', 'structurant'));
ALTER TABLE operations ADD COLUMN IF NOT EXISTS resilience_commentaire TEXT;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS financements_resilience TEXT;

-- ── TABLE RESERVES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reserves (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id  UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  numero        INTEGER NOT NULL,
  description   TEXT NOT NULL,
  lot_concerne  VARCHAR(255),
  responsable   VARCHAR(255),
  delai_levee   DATE,
  date_levee    DATE,
  statut        VARCHAR(20) NOT NULL DEFAULT 'ouverte'
                CHECK (statut IN ('ouverte', 'en_cours', 'levee')),
  commentaire   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reserves_operation ON reserves(operation_id);

CREATE OR REPLACE FUNCTION update_reserves_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reserves_updated_at ON reserves;
CREATE TRIGGER trg_reserves_updated_at
  BEFORE UPDATE ON reserves FOR EACH ROW EXECUTE FUNCTION update_reserves_updated_at();

ALTER TABLE reserves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reserves_select" ON reserves;
DROP POLICY IF EXISTS "reserves_insert" ON reserves;
DROP POLICY IF EXISTS "reserves_update" ON reserves;
DROP POLICY IF EXISTS "reserves_delete" ON reserves;
CREATE POLICY "reserves_select" ON reserves FOR SELECT USING (true);
CREATE POLICY "reserves_insert" ON reserves FOR INSERT WITH CHECK (true);
CREATE POLICY "reserves_update" ON reserves FOR UPDATE USING (true);
CREATE POLICY "reserves_delete" ON reserves FOR DELETE USING (true);

-- ── TABLE DGD ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dgd (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marche_id     UUID NOT NULL REFERENCES marches(id) ON DELETE CASCADE,
  montant_ht    DECIMAL(12,2),
  date_dgd      DATE,
  statut        VARCHAR(20) DEFAULT 'non_etabli'
                CHECK (statut IN ('non_etabli', 'en_cours', 'signe', 'solde')),
  commentaire   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(marche_id)
);

ALTER TABLE dgd ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dgd_select" ON dgd;
DROP POLICY IF EXISTS "dgd_insert" ON dgd;
DROP POLICY IF EXISTS "dgd_update" ON dgd;
DROP POLICY IF EXISTS "dgd_delete" ON dgd;
CREATE POLICY "dgd_select" ON dgd FOR SELECT USING (true);
CREATE POLICY "dgd_insert" ON dgd FOR INSERT WITH CHECK (true);
CREATE POLICY "dgd_update" ON dgd FOR UPDATE USING (true);
CREATE POLICY "dgd_delete" ON dgd FOR DELETE USING (true);

-- ── TABLE LEVIERS RESILIENCE ─────────────────────────────────
CREATE TABLE IF NOT EXISTS leviers_resilience (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volet       INTEGER NOT NULL CHECK (volet IN (1, 2, 3, 4)),
  libelle     VARCHAR(255) NOT NULL,
  description TEXT,
  actif       BOOLEAN DEFAULT TRUE,
  ordre       INTEGER
);

INSERT INTO leviers_resilience (volet, libelle, ordre) VALUES
  (1, 'Désimperméabilisation des sols', 1),
  (1, 'Renaturation (trame verte, bleue, brune)', 2),
  (1, 'Création d''îlots de fraîcheur', 3),
  (1, 'Gestion alternative des eaux pluviales', 4),
  (1, 'Lutte contre les îlots de chaleur urbains', 5),
  (1, 'Végétalisation en toiture ou façade', 6),
  (2, 'Sobriété énergétique (pilotage, régulation)', 7),
  (2, 'Performance énergétique bâtiment (Décret Tertiaire)', 8),
  (2, 'Éclairage LED / éclairage public performant', 9),
  (2, 'Recours aux énergies renouvelables (PV, réseau chaleur)', 10),
  (2, 'Télérelève des consommations', 11),
  (3, 'Confort thermique été / hiver', 12),
  (3, 'Protection des publics vulnérables', 13),
  (3, 'Accessibilité PMR (ERP)', 14),
  (3, 'Continuité de service en situation de crise', 15),
  (3, 'Qualité d''usage et sécurité', 16),
  (4, 'Réduction des coûts d''exploitation à LT', 17),
  (4, 'Éligibilité Fonds vert', 18),
  (4, 'Éligibilité ADEME / Banque des Territoires', 19),
  (4, 'Éligibilité Agence de l''eau', 20),
  (4, 'Articulation avec le PPI', 21),
  (4, 'Retour sur investissement public', 22)
ON CONFLICT DO NOTHING;

ALTER TABLE leviers_resilience ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leviers_select" ON leviers_resilience;
DROP POLICY IF EXISTS "leviers_insert" ON leviers_resilience;
DROP POLICY IF EXISTS "leviers_update" ON leviers_resilience;
DROP POLICY IF EXISTS "leviers_delete" ON leviers_resilience;
CREATE POLICY "leviers_select" ON leviers_resilience FOR SELECT USING (true);
CREATE POLICY "leviers_insert" ON leviers_resilience FOR INSERT WITH CHECK (true);
CREATE POLICY "leviers_update" ON leviers_resilience FOR UPDATE USING (true);
CREATE POLICY "leviers_delete" ON leviers_resilience FOR DELETE USING (true);

-- ── TABLE OPERATION_LEVIERS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS operation_leviers (
  operation_id  UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  levier_id     UUID NOT NULL REFERENCES leviers_resilience(id) ON DELETE CASCADE,
  PRIMARY KEY (operation_id, levier_id)
);

ALTER TABLE operation_leviers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "op_leviers_select" ON operation_leviers;
DROP POLICY IF EXISTS "op_leviers_insert" ON operation_leviers;
DROP POLICY IF EXISTS "op_leviers_delete" ON operation_leviers;
CREATE POLICY "op_leviers_select" ON operation_leviers FOR SELECT USING (true);
CREATE POLICY "op_leviers_insert" ON operation_leviers FOR INSERT WITH CHECK (true);
CREATE POLICY "op_leviers_delete" ON operation_leviers FOR DELETE USING (true);

-- ── TABLE ENGAGEMENTS MANDAT ─────────────────────────────────
CREATE TABLE IF NOT EXISTS engagements_mandat (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intitule      VARCHAR(255) NOT NULL,
  description   TEXT,
  cible         DECIMAL(10,2),
  unite         VARCHAR(50),
  date_echeance DATE,
  ordre         INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE engagements_mandat ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "engagements_select" ON engagements_mandat;
DROP POLICY IF EXISTS "engagements_insert" ON engagements_mandat;
DROP POLICY IF EXISTS "engagements_update" ON engagements_mandat;
DROP POLICY IF EXISTS "engagements_delete" ON engagements_mandat;
CREATE POLICY "engagements_select" ON engagements_mandat FOR SELECT USING (true);
CREATE POLICY "engagements_insert" ON engagements_mandat FOR INSERT WITH CHECK (true);
CREATE POLICY "engagements_update" ON engagements_mandat FOR UPDATE USING (true);
CREATE POLICY "engagements_delete" ON engagements_mandat FOR DELETE USING (true);

-- ── TABLE OPERATION_ENGAGEMENTS ──────────────────────────────
CREATE TABLE IF NOT EXISTS operation_engagements (
  operation_id   UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  engagement_id  UUID NOT NULL REFERENCES engagements_mandat(id) ON DELETE CASCADE,
  contribution   DECIMAL(10,2) DEFAULT 1,
  PRIMARY KEY (operation_id, engagement_id)
);

ALTER TABLE operation_engagements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "op_eng_select" ON operation_engagements;
DROP POLICY IF EXISTS "op_eng_insert" ON operation_engagements;
DROP POLICY IF EXISTS "op_eng_update" ON operation_engagements;
DROP POLICY IF EXISTS "op_eng_delete" ON operation_engagements;
CREATE POLICY "op_eng_select" ON operation_engagements FOR SELECT USING (true);
CREATE POLICY "op_eng_insert" ON operation_engagements FOR INSERT WITH CHECK (true);
CREATE POLICY "op_eng_update" ON operation_engagements FOR UPDATE USING (true);
CREATE POLICY "op_eng_delete" ON operation_engagements FOR DELETE USING (true);

-- ── TABLE AUDIT LOGS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   UUID,
  details     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_select" ON audit_logs;
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
CREATE POLICY "audit_select" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT WITH CHECK (true);

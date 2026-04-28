-- ============================================================
-- OpéraTrack — Migrations PostgreSQL Phase 2
-- Ville de Denain — Finances & Marchés
-- ============================================================

-- ============================================================
-- TABLE : credits_paiement (AP/CP)
-- ============================================================
CREATE TABLE IF NOT EXISTS credits_paiement (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id    UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  annee           INTEGER NOT NULL,
  montant_prevu   DECIMAL(12,2) NOT NULL,
  montant_mandate DECIMAL(12,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(operation_id, annee)
);

CREATE TRIGGER update_credits_paiement_updated_at
  BEFORE UPDATE ON credits_paiement
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE : mouvements_financiers
-- ============================================================
CREATE TABLE IF NOT EXISTS mouvements_financiers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id    UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  type            VARCHAR(20) NOT NULL CHECK (type IN ('engagement', 'mandatement')),
  libelle         VARCHAR(255) NOT NULL,
  montant         DECIMAL(12,2) NOT NULL,
  date_mouvement  DATE NOT NULL,
  reference       VARCHAR(100),
  commentaire     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mouvements_operation_id ON mouvements_financiers(operation_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_type ON mouvements_financiers(type);

CREATE TRIGGER update_mouvements_financiers_updated_at
  BEFORE UPDATE ON mouvements_financiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE : marches
-- ============================================================
CREATE TABLE IF NOT EXISTS marches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id        UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  numero              VARCHAR(50) NOT NULL,
  intitule            VARCHAR(255) NOT NULL,
  type                VARCHAR(50) NOT NULL CHECK (type IN ('travaux', 'maitrise_oeuvre', 'controle', 'autre')),
  procedure           VARCHAR(50) CHECK (procedure IN ('mapa', 'appel_offres_ouvert', 'appel_offres_restreint', 'marche_negocie', 'accord_cadre')),
  titulaire_nom       VARCHAR(255),
  titulaire_siret     VARCHAR(14),
  montant_initial_ht  DECIMAL(12,2) NOT NULL,
  montant_actuel_ht   DECIMAL(12,2),
  date_notification   DATE,
  delai_execution     INTEGER,
  date_fin_prev       DATE,
  date_fin_reelle     DATE,
  statut              VARCHAR(30) DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'termine', 'resilie', 'suspendu')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marches_operation_id ON marches(operation_id);

CREATE TRIGGER update_marches_updated_at
  BEFORE UPDATE ON marches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE : avenants
-- ============================================================
CREATE TABLE IF NOT EXISTS avenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marche_id     UUID NOT NULL REFERENCES marches(id) ON DELETE CASCADE,
  numero        INTEGER NOT NULL,
  objet         VARCHAR(255) NOT NULL,
  montant_ht    DECIMAL(12,2) NOT NULL,
  date_avenant  DATE NOT NULL,
  commentaire   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_avenants_updated_at
  BEFORE UPDATE ON avenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE : ordres_de_service
-- ============================================================
CREATE TABLE IF NOT EXISTS ordres_de_service (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marche_id   UUID NOT NULL REFERENCES marches(id) ON DELETE CASCADE,
  numero      INTEGER NOT NULL,
  type        VARCHAR(30) NOT NULL CHECK (type IN ('demarrage', 'arret', 'reprise', 'modification', 'autre')),
  date_os     DATE NOT NULL,
  objet       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_os_updated_at
  BEFORE UPDATE ON ordres_de_service
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE credits_paiement ENABLE ROW LEVEL SECURITY;
ALTER TABLE mouvements_financiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE marches ENABLE ROW LEVEL SECURITY;
ALTER TABLE avenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordres_de_service ENABLE ROW LEVEL SECURITY;

-- Accès via service_role (API backend) — bypass RLS
-- Les policies ci-dessous s'appliquent aux appels directs Supabase client

CREATE POLICY "service_role_credits" ON credits_paiement FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_mouvements" ON mouvements_financiers FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_marches" ON marches FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_avenants" ON avenants FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_os" ON ordres_de_service FOR ALL TO service_role USING (true);

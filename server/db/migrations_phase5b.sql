-- ============================================================
-- Phase 5b — Suivi des consommations énergétiques
-- OpéraTrack — Ville de Denain
-- Avril 2026
-- ============================================================

-- ── Compteurs ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compteurs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Rattachement (l'un ou l'autre)
  batiment_id       UUID REFERENCES batiments(id) ON DELETE CASCADE,
  armoire_id        UUID REFERENCES armoires_eclairage(id) ON DELETE CASCADE,
  fluide            VARCHAR(30) NOT NULL
                    CHECK (fluide IN ('electricite','gaz','eau','fioul','chaleur_urbain')),
  reference_compteur VARCHAR(100),
  fournisseur       VARCHAR(100),
  unite             VARCHAR(10) NOT NULL
                    CHECK (unite IN ('kWh','m3','litres','MWh')),
  actif             BOOLEAN DEFAULT TRUE,
  date_pose         DATE,
  commentaire       TEXT,
  -- Décret Tertiaire (bâtiments uniquement)
  annee_reference   INTEGER,
  conso_reference   DECIMAL(12,2),
  objectif_valeur_absolue_2030 DECIMAL(12,2),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_rattachement CHECK (
    (batiment_id IS NOT NULL AND armoire_id IS NULL) OR
    (batiment_id IS NULL     AND armoire_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_compteurs_batiment ON compteurs(batiment_id);
CREATE INDEX IF NOT EXISTS idx_compteurs_armoire  ON compteurs(armoire_id);

-- ── Relevés de consommation ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS releves_consommation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compteur_id     UUID NOT NULL REFERENCES compteurs(id) ON DELETE CASCADE,
  periode         DATE NOT NULL,           -- premier jour du mois (ex : 2024-11-01)
  index_debut     DECIMAL(12,2),
  index_fin       DECIMAL(12,2),
  consommation    DECIMAL(12,2) NOT NULL,
  montant_ht      DECIMAL(10,2),
  numero_facture  VARCHAR(100),
  facture_url     VARCHAR(500),
  source          VARCHAR(20) DEFAULT 'manuel'
                  CHECK (source IN ('manuel','import_csv')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(compteur_id, periode)
);

CREATE INDEX IF NOT EXISTS idx_releves_compteur ON releves_consommation(compteur_id);
CREATE INDEX IF NOT EXISTS idx_releves_periode  ON releves_consommation(periode);

-- ── Décret Tertiaire par bâtiment ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decret_tertiaire (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batiment_id         UUID NOT NULL REFERENCES batiments(id) ON DELETE CASCADE UNIQUE,
  annee_reference     INTEGER NOT NULL DEFAULT 2020,
  conso_ref_kwh       DECIMAL(12,2),
  objectif_2030       DECIMAL(12,2),
  objectif_2040       DECIMAL(12,2),
  objectif_2050       DECIMAL(12,2),
  soumis_decret       BOOLEAN DEFAULT FALSE,
  identifiant_operat  VARCHAR(100),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

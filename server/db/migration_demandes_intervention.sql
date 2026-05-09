-- ============================================================
-- Migration : Journal des demandes d'intervention (profil exploitant)
-- ============================================================

CREATE TABLE IF NOT EXISTS demandes_intervention (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batiment_id              UUID NOT NULL REFERENCES batiments(id) ON DELETE CASCADE,
  titre                    VARCHAR(255) NOT NULL,
  description              TEXT,
  urgence                  VARCHAR(20) NOT NULL DEFAULT 'normale'
    CHECK (urgence IN ('normale', 'urgente', 'critique')),
  statut                   VARCHAR(30) NOT NULL DEFAULT 'nouvelle'
    CHECK (statut IN ('nouvelle', 'en_cours', 'planifiee', 'realisee', 'rejetee')),
  demandeur_id             UUID NOT NULL,
  demandeur_nom            VARCHAR(255),
  commentaire_gestionnaire TEXT,
  intervention_id          UUID REFERENCES interventions_patrimoine(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demandes_batiment   ON demandes_intervention(batiment_id);
CREATE INDEX IF NOT EXISTS idx_demandes_demandeur  ON demandes_intervention(demandeur_id);
CREATE INDEX IF NOT EXISTS idx_demandes_statut     ON demandes_intervention(statut);
CREATE INDEX IF NOT EXISTS idx_demandes_created_at ON demandes_intervention(created_at DESC);

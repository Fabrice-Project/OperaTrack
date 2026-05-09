-- Migration : historique des échanges sur les demandes d'intervention
-- À exécuter dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS demandes_intervention_historique (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_id    UUID         NOT NULL REFERENCES demandes_intervention(id) ON DELETE CASCADE,
  auteur_id     UUID         NOT NULL,
  auteur_nom    VARCHAR(255),
  auteur_role   VARCHAR(50),
  type          VARCHAR(30)  NOT NULL DEFAULT 'message'
                             CHECK (type IN ('creation', 'statut', 'commentaire', 'message')),
  ancien_statut VARCHAR(30),
  nouveau_statut VARCHAR(30),
  message       TEXT,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hist_demande_id
  ON demandes_intervention_historique(demande_id, created_at);

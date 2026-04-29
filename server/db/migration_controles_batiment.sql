-- ============================================================
-- Migration : controles_batiment
-- Detache les controles reglementaires des equipements et les
-- rattache directement au batiment.
-- ============================================================

CREATE TABLE IF NOT EXISTS controles_batiment (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  batiment_id            UUID        NOT NULL REFERENCES batiments(id) ON DELETE CASCADE,
  type_controle          TEXT        NOT NULL,
  organisme              TEXT,
  periodicite_mois       INTEGER,
  date_dernier_controle  DATE,
  date_prochain_controle DATE,
  statut                 TEXT        NOT NULL DEFAULT 'a_planifier',
  commentaire            TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour acces rapide par batiment
CREATE INDEX IF NOT EXISTS idx_controles_batiment_batiment_id
  ON controles_batiment (batiment_id);

-- Index pour les alertes d'echeance
CREATE INDEX IF NOT EXISTS idx_controles_batiment_date_prochain
  ON controles_batiment (date_prochain_controle);

-- Commentaire sur la table
COMMENT ON TABLE controles_batiment IS
  'Controles reglementaires rattaches a un batiment (ex: verif electrique, SSI, ascenseur...).';

COMMENT ON COLUMN controles_batiment.statut IS
  'Valeurs : a_planifier | planifie | realise';

-- Migration : Équipements divers (bornes escamotables, fontaines, abris bus, etc.)
-- À exécuter dans l'éditeur SQL Supabase

-- ── Table equipements_divers ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipements_divers (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  intitule      TEXT          NOT NULL,
  categorie     TEXT          DEFAULT 'autre'
                              CHECK (categorie IN (
                                'borne_escamotable','fontaine','abri_bus',
                                'distributeur','horloge','panneau_info','autre'
                              )),
  localisation  TEXT,
  latitude      NUMERIC(10,7),
  longitude     NUMERIC(10,7),
  etat_general  TEXT          DEFAULT 'fonctionnel'
                              CHECK (etat_general IN ('fonctionnel','defaillant','hors_service','en_travaux')),
  annee_pose    INTEGER,
  marque        TEXT,
  modele        TEXT,
  numero_serie  TEXT,
  commentaire   TEXT,
  created_at    TIMESTAMPTZ   DEFAULT now()
);

-- ── Ajout de la FK equipement_id dans la table compteurs ────────────────────
ALTER TABLE compteurs
  ADD COLUMN IF NOT EXISTS equipement_id UUID REFERENCES equipements_divers(id) ON DELETE SET NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE equipements_divers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipements_divers_read"  ON equipements_divers FOR SELECT USING (true);
CREATE POLICY "equipements_divers_write" ON equipements_divers FOR ALL    USING (true);

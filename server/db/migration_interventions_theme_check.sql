-- Migration : mise à jour de la contrainte theme sur interventions_patrimoine
-- pour inclure feux, armoire_feux et equipement_divers
-- À exécuter dans l'éditeur SQL Supabase

ALTER TABLE interventions_patrimoine DROP CONSTRAINT IF EXISTS interventions_patrimoine_theme_check;

ALTER TABLE interventions_patrimoine ADD CONSTRAINT interventions_patrimoine_theme_check
  CHECK (theme IN (
    'voirie',
    'eclairage',
    'armoire',
    'batiment',
    'mobilier',
    'feux',
    'armoire_feux',
    'equipement_divers'
  ));

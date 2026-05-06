-- ============================================================
-- Migration : Mise à jour de la contrainte financeur
-- Ajoute departement, caph, agglo, commune, dpv
-- ============================================================

ALTER TABLE financements DROP CONSTRAINT IF EXISTS financements_financeur_check;

ALTER TABLE financements
  ADD CONSTRAINT financements_financeur_check
  CHECK (financeur IN (
    'anru', 'etat', 'dpv', 'region', 'departement',
    'agglo', 'caph', 'commune', 'autre'
  ));

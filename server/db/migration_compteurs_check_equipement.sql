-- Migration : mise à jour de la contrainte check_rattachement sur compteurs
-- pour inclure equipement_id (équipements divers)
-- À exécuter APRÈS migration_equipements_divers.sql

ALTER TABLE compteurs DROP CONSTRAINT IF EXISTS check_rattachement;

ALTER TABLE compteurs ADD CONSTRAINT check_rattachement CHECK (
  (batiment_id   IS NOT NULL AND armoire_id IS NULL     AND equipement_id IS NULL) OR
  (armoire_id    IS NOT NULL AND batiment_id IS NULL    AND equipement_id IS NULL) OR
  (equipement_id IS NOT NULL AND batiment_id IS NULL    AND armoire_id IS NULL)
);

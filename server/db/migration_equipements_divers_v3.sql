-- Migration v3 : suppression de armoire_id (liaison incorrecte vers armoires_eclairage)
-- Les armoires/compteurs des équipements divers sont propres à chaque équipement
-- et gérés via la table compteurs (compteurs.equipement_id).
-- À exécuter dans l'éditeur SQL Supabase SI la migration v2 a déjà été appliquée.

ALTER TABLE equipements_divers DROP COLUMN IF EXISTS armoire_id;

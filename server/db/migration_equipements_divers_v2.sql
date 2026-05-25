-- Migration v2 : Liaison armoire électrique sur équipements divers
-- À exécuter dans l'éditeur SQL Supabase

ALTER TABLE equipements_divers
  ADD COLUMN IF NOT EXISTS armoire_id UUID REFERENCES armoires_eclairage(id) ON DELETE SET NULL;

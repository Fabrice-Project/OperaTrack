-- ============================================================
-- Migration : Rattachement des mouvements financiers à un marché
-- OpéraTrack — tous les mouvements doivent être liés à un marché
-- ============================================================

-- Ajouter la colonne marche_id (nullable pour ne pas bloquer l'existant)
ALTER TABLE mouvements_financiers
  ADD COLUMN IF NOT EXISTS marche_id UUID REFERENCES marches(id) ON DELETE SET NULL;

-- Index pour les requêtes par marché
CREATE INDEX IF NOT EXISTS idx_mouvements_marche_id
  ON mouvements_financiers(marche_id);

-- Vérification
-- SELECT COUNT(*) FROM mouvements_financiers WHERE marche_id IS NULL;

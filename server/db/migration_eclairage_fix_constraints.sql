-- ============================================================
-- Migration : Assouplissement des contraintes de la table points_lumineux
-- OpéraTrack — Ville de Denain
-- Contexte : import Excel du parc d'éclairage public
-- ============================================================

-- ── 1. Supprimer la contrainte CHECK sur type_support ─────────────────────────
--    La contrainte ne couvre pas les valeurs réelles du parc
--    (ex : "Candélabre 1 CROSSE", "Poteau 1 CONSOLE", "Façade 1 CONSOLE"…)
ALTER TABLE points_lumineux
  DROP CONSTRAINT IF EXISTS points_lumineux_type_support_check;

-- ── 2. Passer type_support en TEXT ───────────────────────────────────────────
--    VARCHAR(30) trop court : "Candélabre 1 Vector Double Tirant" = 33 chars
ALTER TABLE points_lumineux
  ALTER COLUMN type_support TYPE TEXT;

-- ── 3. Passer type_lampe en TEXT ─────────────────────────────────────────────
--    Permet de stocker les descriptions libres si nécessaire
ALTER TABLE points_lumineux
  ALTER COLUMN type_lampe TYPE TEXT;

-- ── 4. Supprimer l'éventuelle contrainte CHECK sur type_lampe ─────────────────
ALTER TABLE points_lumineux
  DROP CONSTRAINT IF EXISTS points_lumineux_type_lampe_check;

-- ── Vérification ─────────────────────────────────────────────────────────────
-- Après exécution, relancer l'import Excel depuis l'application.

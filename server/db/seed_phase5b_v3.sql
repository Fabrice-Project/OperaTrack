-- ============================================================
-- Phase 5b -- Seed v3 : Correction + Centre aquatique / Ecole / Acacias
-- Opera Track -- Ville de Denain -- Avril 2026
-- ============================================================
-- Batiments reels confirmes :
--   3fa6b6f9  Centre aquatique
--   b1b7bf4c  Centre technique municipal
--   10b9602b  Ecole primaire Jules Ferry
--   9b590bac  Gymnase Jean Bouin        (deja instrumente)
--   003ba53f  Hotel de ville            (deja instrumente)
--   d1d13835  Maison de quartier des Acacias
--
-- Ce fichier ajoute :
--   - Compteurs Centre aquatique (elec, gaz, eau)
--   - Compteurs Ecole primaire Jules Ferry (elec, gaz)
--   - Decret Tertiaire Centre aquatique + Ecole Jules Ferry
--   - Releves 2024 : Centre aquatique, Ecole, Maison Acacias
--   - Releves 2023 (N-1) : Centre aquatique, Ecole
-- ============================================================


-- ============================================================
-- 1. COMPTEUR CENTRE AQUATIQUE -- Electricite
--    Surface ~2 500 m2 | annee ref 2020 | 380 000 kWh
-- ============================================================

INSERT INTO compteurs (batiment_id, fluide, reference_compteur, fournisseur, unite, annee_reference, conso_reference)
SELECT '3fa6b6f9-6731-4e63-8430-5116bf803b61', 'electricite', 'PDL-59220-CA-001', 'EDF', 'kWh', 2020, 380000
WHERE NOT EXISTS (
  SELECT 1 FROM compteurs
  WHERE batiment_id = '3fa6b6f9-6731-4e63-8430-5116bf803b61' AND fluide = 'electricite'
);


-- ============================================================
-- 2. COMPTEUR CENTRE AQUATIQUE -- Gaz
--    annee ref 2020 | 52 000 m3
-- ============================================================

INSERT INTO compteurs (batiment_id, fluide, reference_compteur, fournisseur, unite, annee_reference, conso_reference)
SELECT '3fa6b6f9-6731-4e63-8430-5116bf803b61', 'gaz', 'PCE-59220-CA-001', 'ENGIE', 'm3', 2020, 52000
WHERE NOT EXISTS (
  SELECT 1 FROM compteurs
  WHERE batiment_id = '3fa6b6f9-6731-4e63-8430-5116bf803b61' AND fluide = 'gaz'
);


-- ============================================================
-- 3. COMPTEUR CENTRE AQUATIQUE -- Eau
-- ============================================================

INSERT INTO compteurs (batiment_id, fluide, reference_compteur, fournisseur, unite)
SELECT '3fa6b6f9-6731-4e63-8430-5116bf803b61', 'eau', 'CPT-CA-001', 'Regie eau Denain', 'm3'
WHERE NOT EXISTS (
  SELECT 1 FROM compteurs
  WHERE batiment_id = '3fa6b6f9-6731-4e63-8430-5116bf803b61' AND fluide = 'eau'
);


-- ============================================================
-- 4. COMPTEUR ECOLE PRIMAIRE JULES FERRY -- Electricite
--    Surface ~1 200 m2 | annee ref 2020 | 62 000 kWh
-- ============================================================

INSERT INTO compteurs (batiment_id, fluide, reference_compteur, fournisseur, unite, annee_reference, conso_reference)
SELECT '10b9602b-049f-451f-813e-a6daaff11204', 'electricite', 'PDL-59220-EJF-001', 'EDF', 'kWh', 2020, 62000
WHERE NOT EXISTS (
  SELECT 1 FROM compteurs
  WHERE batiment_id = '10b9602b-049f-451f-813e-a6daaff11204' AND fluide = 'electricite'
);


-- ============================================================
-- 5. COMPTEUR ECOLE PRIMAIRE JULES FERRY -- Gaz
--    annee ref 2020 | 11 500 m3
-- ============================================================

INSERT INTO compteurs (batiment_id, fluide, reference_compteur, fournisseur, unite, annee_reference, conso_reference)
SELECT '10b9602b-049f-451f-813e-a6daaff11204', 'gaz', 'PCE-59220-EJF-001', 'ENGIE', 'm3', 2020, 11500
WHERE NOT EXISTS (
  SELECT 1 FROM compteurs
  WHERE batiment_id = '10b9602b-049f-451f-813e-a6daaff11204' AND fluide = 'gaz'
);


-- ============================================================
-- 6. DECRET TERTIAIRE -- Centre aquatique
--    conso_ref_kwh 2020 = elec (380 000 x 1,0) + gaz (52 000 x 11,6)
--                       = 380 000 + 603 200 = 983 200 kWhef
--    Intensite ref : 983 200 / 2 500 m2 = 393 kWhef/m2 (Energivore)
-- ============================================================

INSERT INTO decret_tertiaire (batiment_id, annee_reference, conso_ref_kwh, soumis_decret, identifiant_operat)
VALUES (
  '3fa6b6f9-6731-4e63-8430-5116bf803b61',
  2020, 983200, TRUE, 'OPERAT-59220-CA-001'
)
ON CONFLICT (batiment_id) DO NOTHING;


-- ============================================================
-- 7. DECRET TERTIAIRE -- Ecole primaire Jules Ferry
--    conso_ref_kwh 2020 = elec (62 000 x 1,0) + gaz (11 500 x 11,6)
--                       = 62 000 + 133 400 = 195 400 kWhef
--    Intensite ref : 195 400 / 1 200 m2 = 163 kWhef/m2 (Moyen)
-- ============================================================

INSERT INTO decret_tertiaire (batiment_id, annee_reference, conso_ref_kwh, soumis_decret, identifiant_operat)
VALUES (
  '10b9602b-049f-451f-813e-a6daaff11204',
  2020, 195400, TRUE, 'OPERAT-59220-EJF-001'
)
ON CONFLICT (batiment_id) DO NOTHING;


-- ============================================================
-- 8. RELEVES 2024 -- CENTRE AQUATIQUE -- Electricite
--    Ref PDL-59220-CA-001 | Annuel ~289 000 kWh | 0,160 EUR/kWh HT
--    Profil : stable (pompes 24h/24), pic ete (affluence)
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2024-01-01'::DATE, 22800, 3648.00),
  ('2024-02-01'::DATE, 21500, 3440.00),
  ('2024-03-01'::DATE, 22000, 3520.00),
  ('2024-04-01'::DATE, 23500, 3760.00),
  ('2024-05-01'::DATE, 25000, 4000.00),
  ('2024-06-01'::DATE, 26500, 4240.00),
  ('2024-07-01'::DATE, 28000, 4480.00),
  ('2024-08-01'::DATE, 27500, 4400.00),
  ('2024-09-01'::DATE, 25000, 4000.00),
  ('2024-10-01'::DATE, 23000, 3680.00),
  ('2024-11-01'::DATE, 22000, 3520.00),
  ('2024-12-01'::DATE, 22200, 3552.00)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'PDL-59220-CA-001'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- 9. RELEVES 2024 -- CENTRE AQUATIQUE -- Gaz
--    Ref PCE-59220-CA-001 | Annuel ~46 800 m3 | 0,80 EUR/m3 HT
--    Profil : pic hiver (chauffage + eau bassin), creux ete
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2024-01-01'::DATE, 5800, 4640.00),
  ('2024-02-01'::DATE, 5200, 4160.00),
  ('2024-03-01'::DATE, 4400, 3520.00),
  ('2024-04-01'::DATE, 3600, 2880.00),
  ('2024-05-01'::DATE, 2900, 2320.00),
  ('2024-06-01'::DATE, 2600, 2080.00),
  ('2024-07-01'::DATE, 2400, 1920.00),
  ('2024-08-01'::DATE, 2400, 1920.00),
  ('2024-09-01'::DATE, 2800, 2240.00),
  ('2024-10-01'::DATE, 3700, 2960.00),
  ('2024-11-01'::DATE, 4600, 3680.00),
  ('2024-12-01'::DATE, 5400, 4320.00)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'PCE-59220-CA-001'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- 10. RELEVES 2024 -- CENTRE AQUATIQUE -- Eau
--     Ref CPT-CA-001 | Annuel ~8 500 m3 | 2,50 EUR/m3 HT
--     Profil : pic ete (evaporation + affluence), stable hiver
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2024-01-01'::DATE,  560, 1400.00),
  ('2024-02-01'::DATE,  540, 1350.00),
  ('2024-03-01'::DATE,  600, 1500.00),
  ('2024-04-01'::DATE,  680, 1700.00),
  ('2024-05-01'::DATE,  760, 1900.00),
  ('2024-06-01'::DATE,  820, 2050.00),
  ('2024-07-01'::DATE, 1000, 2500.00),
  ('2024-08-01'::DATE,  980, 2450.00),
  ('2024-09-01'::DATE,  760, 1900.00),
  ('2024-10-01'::DATE,  680, 1700.00),
  ('2024-11-01'::DATE,  600, 1500.00),
  ('2024-12-01'::DATE,  560, 1400.00)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'CPT-CA-001'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- 11. RELEVES 2024 -- ECOLE PRIMAIRE JULES FERRY -- Electricite
--     Ref PDL-59220-EJF-001 | Annuel ~49 700 kWh | 0,160 EUR/kWh HT
--     Profil : quasi-zero juillet-aout (fermeture estivale)
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2024-01-01'::DATE, 5800,  928.00),
  ('2024-02-01'::DATE, 5400,  864.00),
  ('2024-03-01'::DATE, 5000,  800.00),
  ('2024-04-01'::DATE, 4600,  736.00),
  ('2024-05-01'::DATE, 4200,  672.00),
  ('2024-06-01'::DATE, 3800,  608.00),
  ('2024-07-01'::DATE,  200,   32.00),
  ('2024-08-01'::DATE,  100,   16.00),
  ('2024-09-01'::DATE, 4400,  704.00),
  ('2024-10-01'::DATE, 5000,  800.00),
  ('2024-11-01'::DATE, 5400,  864.00),
  ('2024-12-01'::DATE, 5800,  928.00)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'PDL-59220-EJF-001'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- 12. RELEVES 2024 -- ECOLE PRIMAIRE JULES FERRY -- Gaz
--     Ref PCE-59220-EJF-001 | Annuel ~9 800 m3 | 0,80 EUR/m3 HT
--     Profil : chauffage oct-avril uniquement
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2024-01-01'::DATE, 2200, 1760.00),
  ('2024-02-01'::DATE, 1900, 1520.00),
  ('2024-03-01'::DATE, 1400, 1120.00),
  ('2024-04-01'::DATE,  600,  480.00),
  ('2024-05-01'::DATE,  150,  120.00),
  ('2024-06-01'::DATE,   50,   40.00),
  ('2024-07-01'::DATE,    0,    0.00),
  ('2024-08-01'::DATE,    0,    0.00),
  ('2024-09-01'::DATE,  200,  160.00),
  ('2024-10-01'::DATE, 1100,  880.00),
  ('2024-11-01'::DATE, 1800, 1440.00),
  ('2024-12-01'::DATE, 2100, 1680.00)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'PCE-59220-EJF-001'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- 13. RELEVES 2024 -- MAISON DE QUARTIER DES ACACIAS -- Electricite
--     Ref PDL-59220-003 | Annuel ~22 300 kWh | 0,160 EUR/kWh HT
--     Profil : pompe a chaleur, leger pic ete (climatisation)
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2024-01-01'::DATE, 2400,  384.00),
  ('2024-02-01'::DATE, 2200,  352.00),
  ('2024-03-01'::DATE, 1800,  288.00),
  ('2024-04-01'::DATE, 1500,  240.00),
  ('2024-05-01'::DATE, 1400,  224.00),
  ('2024-06-01'::DATE, 1700,  272.00),
  ('2024-07-01'::DATE, 2000,  320.00),
  ('2024-08-01'::DATE, 1800,  288.00),
  ('2024-09-01'::DATE, 1600,  256.00),
  ('2024-10-01'::DATE, 1700,  272.00),
  ('2024-11-01'::DATE, 2000,  320.00),
  ('2024-12-01'::DATE, 2200,  352.00)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'PDL-59220-003'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- 14. RELEVES 2023 (N-1) -- CENTRE AQUATIQUE -- Electricite
--     Ref PDL-59220-CA-001 | Annuel ~310 000 kWh (avant optimisation)
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2023-01-01'::DATE, 24500, 3920.00),
  ('2023-02-01'::DATE, 23200, 3712.00),
  ('2023-03-01'::DATE, 23600, 3776.00),
  ('2023-04-01'::DATE, 25200, 4032.00),
  ('2023-05-01'::DATE, 26800, 4288.00),
  ('2023-06-01'::DATE, 28400, 4544.00),
  ('2023-07-01'::DATE, 30000, 4800.00),
  ('2023-08-01'::DATE, 29500, 4720.00),
  ('2023-09-01'::DATE, 26800, 4288.00),
  ('2023-10-01'::DATE, 24600, 3936.00),
  ('2023-11-01'::DATE, 23600, 3776.00),
  ('2023-12-01'::DATE, 23800, 3808.00)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'PDL-59220-CA-001'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- 15. RELEVES 2023 (N-1) -- ECOLE PRIMAIRE JULES FERRY -- Electricite
--     Ref PDL-59220-EJF-001 | Annuel ~54 300 kWh (avant travaux)
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2023-01-01'::DATE, 6300, 1008.00),
  ('2023-02-01'::DATE, 5900,  944.00),
  ('2023-03-01'::DATE, 5500,  880.00),
  ('2023-04-01'::DATE, 5100,  816.00),
  ('2023-05-01'::DATE, 4700,  752.00),
  ('2023-06-01'::DATE, 4300,  688.00),
  ('2023-07-01'::DATE,  250,   40.00),
  ('2023-08-01'::DATE,  100,   16.00),
  ('2023-09-01'::DATE, 4900,  784.00),
  ('2023-10-01'::DATE, 5500,  880.00),
  ('2023-11-01'::DATE, 5900,  944.00),
  ('2023-12-01'::DATE, 6300, 1008.00)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'PDL-59220-EJF-001'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- VERIFICATION FINALE
-- ============================================================

SELECT
  (SELECT COUNT(*) FROM compteurs)                                                     AS nb_compteurs,
  (SELECT COUNT(*) FROM releves_consommation)                                          AS nb_releves,
  (SELECT COUNT(*) FROM decret_tertiaire)                                              AS nb_decrets,
  (SELECT COUNT(*) FROM releves_consommation WHERE EXTRACT(YEAR FROM periode) = 2024) AS releves_2024,
  (SELECT COUNT(*) FROM releves_consommation WHERE EXTRACT(YEAR FROM periode) = 2023) AS releves_2023;

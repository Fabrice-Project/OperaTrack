-- ============================================================
-- Phase 5b -- Seed v2 : Compteurs & Consommations enrichis
-- Opera Track -- Ville de Denain -- Avril 2026
-- ============================================================
-- Ce fichier ajoute :
--   - Compteurs Bibliotheque (elec, gaz, eau)
--   - Compteur ARM-03 si absent
--   - Decret Tertiaire Bibliotheque
--   - Releves 2024 : Gymnase, Bibliotheque, ARM-02, ARM-03
--   - Releves 2023 (N-1) : Hotel de ville, Gymnase, Bibliotheque, ARM-01
-- Tous les INSERT sont idempotents (ON CONFLICT DO NOTHING)
-- ============================================================


-- ============================================================
-- 1. COMPTEUR BIBLIOTHEQUE -- Electricite
--    Reference PDL-59220-BIB-001 | annee ref 2019 | 48 200 kWh
-- ============================================================

INSERT INTO compteurs (batiment_id, fluide, reference_compteur, fournisseur, unite, annee_reference, conso_reference)
SELECT b.id, 'electricite', 'PDL-59220-BIB-001', 'EDF', 'kWh', 2019, 48200
FROM batiments b
WHERE b.intitule ILIKE '%iblioth%'
  AND NOT EXISTS (
    SELECT 1 FROM compteurs WHERE batiment_id = b.id AND fluide = 'electricite'
  );


-- ============================================================
-- 2. COMPTEUR BIBLIOTHEQUE -- Gaz
--    Reference PCE-59220-BIB-001 | annee ref 2019 | 6 800 m3
-- ============================================================

INSERT INTO compteurs (batiment_id, fluide, reference_compteur, fournisseur, unite, annee_reference, conso_reference)
SELECT b.id, 'gaz', 'PCE-59220-BIB-001', 'ENGIE', 'm3', 2019, 6800
FROM batiments b
WHERE b.intitule ILIKE '%iblioth%'
  AND NOT EXISTS (
    SELECT 1 FROM compteurs WHERE batiment_id = b.id AND fluide = 'gaz'
  );


-- ============================================================
-- 3. COMPTEUR BIBLIOTHEQUE -- Eau
--    Reference CPT-BIB-001
-- ============================================================

INSERT INTO compteurs (batiment_id, fluide, reference_compteur, fournisseur, unite)
SELECT b.id, 'eau', 'CPT-BIB-001', 'Regie eau Denain', 'm3'
FROM batiments b
WHERE b.intitule ILIKE '%iblioth%'
  AND NOT EXISTS (
    SELECT 1 FROM compteurs WHERE batiment_id = b.id AND fluide = 'eau'
  );


-- ============================================================
-- 4. COMPTEUR ARM-03 -- Electricite (si absent)
--    Reference PDL-EP-003
-- ============================================================

INSERT INTO compteurs (armoire_id, fluide, reference_compteur, fournisseur, unite)
SELECT a.id, 'electricite', 'PDL-EP-003', 'Enedis', 'kWh'
FROM armoires_eclairage a
WHERE a.intitule LIKE 'ARM-03%'
  AND NOT EXISTS (
    SELECT 1 FROM compteurs WHERE armoire_id = a.id AND fluide = 'electricite'
  );


-- ============================================================
-- 5. DECRET TERTIAIRE -- Bibliotheque
--    Surface ~850 m2 | annee ref 2019
--    conso_ref_kwh = 127 920 kWhef
--      = elec 2019 (48 200 x 1,0) + gaz 2019 (6 800 m3 x 11,6 kWhef/m3)
--      = 48 200 + 78 880 = 127 080 ~ 127 920 kWhef
-- ============================================================

INSERT INTO decret_tertiaire (batiment_id, annee_reference, conso_ref_kwh, soumis_decret, identifiant_operat)
SELECT b.id, 2019, 127920, TRUE, 'OPERAT-59220-BIB-001'
FROM batiments b
WHERE b.intitule ILIKE '%iblioth%'
ON CONFLICT (batiment_id) DO NOTHING;


-- ============================================================
-- 6. RELEVES 2024 -- GYMNASE JEAN BOUIN -- Electricite
--    Ref PDL-59220-002 | Annuel ~90 200 kWh | 0,160 EUR/kWh HT
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2024-01-01'::DATE,  9800, 1568.00),
  ('2024-02-01'::DATE,  9200, 1472.00),
  ('2024-03-01'::DATE,  8500, 1360.00),
  ('2024-04-01'::DATE,  7800, 1248.00),
  ('2024-05-01'::DATE,  6500, 1040.00),
  ('2024-06-01'::DATE,  5200,  832.00),
  ('2024-07-01'::DATE,  5800,  928.00),
  ('2024-08-01'::DATE,  3200,  512.00),
  ('2024-09-01'::DATE,  6200,  992.00),
  ('2024-10-01'::DATE,  8200, 1312.00),
  ('2024-11-01'::DATE,  9500, 1520.00),
  ('2024-12-01'::DATE, 10300, 1648.00)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'PDL-59220-002'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- 7. RELEVES 2024 -- GYMNASE JEAN BOUIN -- Gaz
--    Ref PCE-59220-002 | Annuel ~21 050 m3 | 0,80 EUR/m3 HT
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2024-01-01'::DATE, 3800, 3040.00),
  ('2024-02-01'::DATE, 3500, 2800.00),
  ('2024-03-01'::DATE, 2600, 2080.00),
  ('2024-04-01'::DATE, 1200,  960.00),
  ('2024-05-01'::DATE,  300,  240.00),
  ('2024-06-01'::DATE,   50,   40.00),
  ('2024-07-01'::DATE,   50,   40.00),
  ('2024-08-01'::DATE,   50,   40.00),
  ('2024-09-01'::DATE,  400,  320.00),
  ('2024-10-01'::DATE, 1800, 1440.00),
  ('2024-11-01'::DATE, 3100, 2480.00),
  ('2024-12-01'::DATE, 3900, 3120.00)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'PCE-59220-002'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- 8. RELEVES 2024 -- GYMNASE JEAN BOUIN -- Eau
--    Ref CPT-GYM-001 | Annuel ~3 340 m3 | 2,50 EUR/m3 HT
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2024-01-01'::DATE, 280,  700.00),
  ('2024-02-01'::DATE, 310,  775.00),
  ('2024-03-01'::DATE, 340,  850.00),
  ('2024-04-01'::DATE, 380,  950.00),
  ('2024-05-01'::DATE, 360,  900.00),
  ('2024-06-01'::DATE, 280,  700.00),
  ('2024-07-01'::DATE, 180,  450.00),
  ('2024-08-01'::DATE, 100,  250.00),
  ('2024-09-01'::DATE, 280,  700.00),
  ('2024-10-01'::DATE, 360,  900.00),
  ('2024-11-01'::DATE, 370,  925.00),
  ('2024-12-01'::DATE, 300,  750.00)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'CPT-GYM-001'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- 9. RELEVES 2024 -- BIBLIOTHEQUE -- Electricite
--    Ref PDL-59220-BIB-001 | Annuel ~41 400 kWh | 0,160 EUR/kWh HT
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2024-01-01'::DATE, 4200,  672.00),
  ('2024-02-01'::DATE, 4100,  656.00),
  ('2024-03-01'::DATE, 3800,  608.00),
  ('2024-04-01'::DATE, 3500,  560.00),
  ('2024-05-01'::DATE, 3200,  512.00),
  ('2024-06-01'::DATE, 3400,  544.00),
  ('2024-07-01'::DATE, 3100,  496.00),
  ('2024-08-01'::DATE, 2200,  352.00),
  ('2024-09-01'::DATE, 3600,  576.00),
  ('2024-10-01'::DATE, 3900,  624.00),
  ('2024-11-01'::DATE, 4100,  656.00),
  ('2024-12-01'::DATE, 4300,  688.00)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'PDL-59220-BIB-001'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- 10. RELEVES 2024 -- BIBLIOTHEQUE -- Gaz
--     Ref PCE-59220-BIB-001 | Annuel ~6 390 m3 | 0,80 EUR/m3 HT
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2024-01-01'::DATE, 1200,  960.00),
  ('2024-02-01'::DATE, 1100,  880.00),
  ('2024-03-01'::DATE,  800,  640.00),
  ('2024-04-01'::DATE,  350,  280.00),
  ('2024-05-01'::DATE,   80,   64.00),
  ('2024-06-01'::DATE,   20,   16.00),
  ('2024-07-01'::DATE,   20,   16.00),
  ('2024-08-01'::DATE,   20,   16.00),
  ('2024-09-01'::DATE,  100,   80.00),
  ('2024-10-01'::DATE,  600,  480.00),
  ('2024-11-01'::DATE,  900,  720.00),
  ('2024-12-01'::DATE, 1200,  960.00)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'PCE-59220-BIB-001'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- 11. RELEVES 2024 -- ARM-02 -- Electricite
--     Ref PDL-EP-002 | Annuel ~15 740 kWh | 0,160 EUR/kWh HT
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2024-01-01'::DATE, 2150,  344.00),
  ('2024-02-01'::DATE, 1980,  316.80),
  ('2024-03-01'::DATE, 1680,  268.80),
  ('2024-04-01'::DATE, 1320,  211.20),
  ('2024-05-01'::DATE, 1050,  168.00),
  ('2024-06-01'::DATE,  920,  147.20),
  ('2024-07-01'::DATE,  980,  156.80),
  ('2024-08-01'::DATE, 1100,  176.00),
  ('2024-09-01'::DATE, 1380,  220.80),
  ('2024-10-01'::DATE, 1840,  294.40),
  ('2024-11-01'::DATE, 2060,  329.60),
  ('2024-12-01'::DATE, 2280,  364.80)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'PDL-EP-002'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- 12. RELEVES 2024 -- ARM-03 -- Electricite
--     Ref PDL-EP-003 | Annuel ~10 640 kWh | 0,160 EUR/kWh HT
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2024-01-01'::DATE, 1250,  200.00),
  ('2024-02-01'::DATE, 1140,  182.40),
  ('2024-03-01'::DATE,  950,  152.00),
  ('2024-04-01'::DATE,  740,  118.40),
  ('2024-05-01'::DATE,  580,   92.80),
  ('2024-06-01'::DATE,  500,   80.00),
  ('2024-07-01'::DATE,  540,   86.40),
  ('2024-08-01'::DATE,  620,   99.20),
  ('2024-09-01'::DATE,  780,  124.80),
  ('2024-10-01'::DATE, 1040,  166.40),
  ('2024-11-01'::DATE, 1180,  188.80),
  ('2024-12-01'::DATE, 1320,  211.20)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'PDL-EP-003'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- 13. RELEVES 2023 (N-1) -- HOTEL DE VILLE -- Electricite
--     Ref PDL-59220-001 | Annuel ~138 100 kWh (avant renovation)
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2023-01-01'::DATE, 15400, 2464.00),
  ('2023-02-01'::DATE, 14200, 2272.00),
  ('2023-03-01'::DATE, 12800, 2048.00),
  ('2023-04-01'::DATE, 10100, 1616.00),
  ('2023-05-01'::DATE,  8600, 1376.00),
  ('2023-06-01'::DATE,  7900, 1264.00),
  ('2023-07-01'::DATE,  7600, 1216.00),
  ('2023-08-01'::DATE,  6400, 1024.00),
  ('2023-09-01'::DATE,  8900, 1424.00),
  ('2023-10-01'::DATE, 12200, 1952.00),
  ('2023-11-01'::DATE, 14500, 2320.00),
  ('2023-12-01'::DATE, 15500, 2480.00)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'PDL-59220-001'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- 14. RELEVES 2023 (N-1) -- HOTEL DE VILLE -- Gaz
--     Ref PCE-59220-001 | Annuel ~15 520 m3 (avant renovation)
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2023-01-01'::DATE, 3200, 2560.00),
  ('2023-02-01'::DATE, 2900, 2320.00),
  ('2023-03-01'::DATE, 2200, 1760.00),
  ('2023-04-01'::DATE,  950,  760.00),
  ('2023-05-01'::DATE,  250,  200.00),
  ('2023-06-01'::DATE,   80,   64.00),
  ('2023-07-01'::DATE,   80,   64.00),
  ('2023-08-01'::DATE,   80,   64.00),
  ('2023-09-01'::DATE,  380,  304.00),
  ('2023-10-01'::DATE, 1700, 1360.00),
  ('2023-11-01'::DATE, 2600, 2080.00),
  ('2023-12-01'::DATE, 3100, 2480.00)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'PCE-59220-001'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- 15. RELEVES 2023 (N-1) -- GYMNASE JEAN BOUIN -- Electricite
--     Ref PDL-59220-002 | Annuel ~109 400 kWh (avant LED)
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2023-01-01'::DATE, 10800, 1728.00),
  ('2023-02-01'::DATE, 10200, 1632.00),
  ('2023-03-01'::DATE,  9400, 1504.00),
  ('2023-04-01'::DATE,  8600, 1376.00),
  ('2023-05-01'::DATE,  7200, 1152.00),
  ('2023-06-01'::DATE,  5800,  928.00),
  ('2023-07-01'::DATE,  6400, 1024.00),
  ('2023-08-01'::DATE,  3600,  576.00),
  ('2023-09-01'::DATE,  6900, 1104.00),
  ('2023-10-01'::DATE,  9100, 1456.00),
  ('2023-11-01'::DATE, 10500, 1680.00),
  ('2023-12-01'::DATE, 11200, 1792.00)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'PDL-59220-002'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- 16. RELEVES 2023 (N-1) -- GYMNASE JEAN BOUIN -- Gaz
--     Ref PCE-59220-002 | Annuel ~24 920 m3
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2023-01-01'::DATE, 4100, 3280.00),
  ('2023-02-01'::DATE, 3800, 3040.00),
  ('2023-03-01'::DATE, 2900, 2320.00),
  ('2023-04-01'::DATE, 1400, 1120.00),
  ('2023-05-01'::DATE,  380,  304.00),
  ('2023-06-01'::DATE,   80,   64.00),
  ('2023-07-01'::DATE,   80,   64.00),
  ('2023-08-01'::DATE,   80,   64.00),
  ('2023-09-01'::DATE,  500,  400.00),
  ('2023-10-01'::DATE, 2000, 1600.00),
  ('2023-11-01'::DATE, 3400, 2720.00),
  ('2023-12-01'::DATE, 4200, 3360.00)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'PCE-59220-002'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- 17. RELEVES 2023 (N-1) -- BIBLIOTHEQUE -- Electricite
--     Ref PDL-59220-BIB-001 | Annuel ~45 600 kWh (avant travaux)
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2023-01-01'::DATE, 4600,  736.00),
  ('2023-02-01'::DATE, 4500,  720.00),
  ('2023-03-01'::DATE, 4200,  672.00),
  ('2023-04-01'::DATE, 3900,  624.00),
  ('2023-05-01'::DATE, 3600,  576.00),
  ('2023-06-01'::DATE, 3700,  592.00),
  ('2023-07-01'::DATE, 3400,  544.00),
  ('2023-08-01'::DATE, 2500,  400.00),
  ('2023-09-01'::DATE, 3900,  624.00),
  ('2023-10-01'::DATE, 4200,  672.00),
  ('2023-11-01'::DATE, 4400,  704.00),
  ('2023-12-01'::DATE, 4700,  752.00)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'PDL-59220-BIB-001'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- 18. RELEVES 2023 (N-1) -- ARM-01 -- Electricite
--     Ref PDL-EP-001 | Annuel ~20 070 kWh (avant LED partiel)
-- ============================================================

INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source)
SELECT c.id, d.periode::DATE, d.consommation, d.montant_ht, 'manuel'
FROM compteurs c
CROSS JOIN (VALUES
  ('2023-01-01'::DATE, 2080,  332.80),
  ('2023-02-01'::DATE, 1920,  307.20),
  ('2023-03-01'::DATE, 1620,  259.20),
  ('2023-04-01'::DATE, 1260,  201.60),
  ('2023-05-01'::DATE, 1010,  161.60),
  ('2023-06-01'::DATE,  870,  139.20),
  ('2023-07-01'::DATE,  940,  150.40),
  ('2023-08-01'::DATE, 1080,  172.80),
  ('2023-09-01'::DATE, 1320,  211.20),
  ('2023-10-01'::DATE, 1780,  284.80),
  ('2023-11-01'::DATE, 1990,  318.40),
  ('2023-12-01'::DATE, 2200,  352.00)
) AS d(periode, consommation, montant_ht)
WHERE c.reference_compteur = 'PDL-EP-001'
ON CONFLICT (compteur_id, periode) DO NOTHING;


-- ============================================================
-- VERIFICATION FINALE
-- ============================================================

SELECT
  (SELECT COUNT(*) FROM compteurs)                                                      AS nb_compteurs,
  (SELECT COUNT(*) FROM releves_consommation)                                           AS nb_releves,
  (SELECT COUNT(*) FROM decret_tertiaire)                                               AS nb_decrets,
  (SELECT COUNT(*) FROM releves_consommation WHERE EXTRACT(YEAR FROM periode) = 2024)  AS releves_2024,
  (SELECT COUNT(*) FROM releves_consommation WHERE EXTRACT(YEAR FROM periode) = 2023)  AS releves_2023;

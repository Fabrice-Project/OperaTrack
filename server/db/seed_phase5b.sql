-- ============================================================
-- Phase 5b — Seed consommations énergétiques
-- OpéraTrack — Ville de Denain
-- ============================================================

-- ── Compteurs Hôtel de Ville ──────────────────────────────────────────────────
INSERT INTO compteurs (batiment_id, fluide, reference_compteur, fournisseur, unite, annee_reference, conso_reference)
SELECT id, 'electricite', 'PDL-59220-001', 'EDF', 'kWh', 2020, 142000
FROM batiments WHERE intitule = 'Hôtel de Ville'
ON CONFLICT DO NOTHING;

INSERT INTO compteurs (batiment_id, fluide, reference_compteur, fournisseur, unite, annee_reference, conso_reference)
SELECT id, 'gaz', 'PCE-59220-001', 'ENGIE', 'm3', 2020, 18500
FROM batiments WHERE intitule = 'Hôtel de Ville'
ON CONFLICT DO NOTHING;

INSERT INTO compteurs (batiment_id, fluide, reference_compteur, fournisseur, unite)
SELECT id, 'eau', 'CPT-HV-001', 'Régie eau Denain', 'm3'
FROM batiments WHERE intitule = 'Hôtel de Ville'
ON CONFLICT DO NOTHING;

-- ── Décret Tertiaire Hôtel de Ville ──────────────────────────────────────────
INSERT INTO decret_tertiaire (batiment_id, annee_reference, conso_ref_kwh, soumis_decret, identifiant_operat)
SELECT id, 2020, 356400, TRUE, 'OPERAT-59220-HV-001'
FROM batiments WHERE intitule = 'Hôtel de Ville'
ON CONFLICT (batiment_id) DO NOTHING;

-- ── Compteurs Gymnase Jean Bouin ──────────────────────────────────────────────
INSERT INTO compteurs (batiment_id, fluide, reference_compteur, fournisseur, unite, annee_reference, conso_reference)
SELECT id, 'electricite', 'PDL-59220-002', 'EDF', 'kWh', 2020, 89000
FROM batiments WHERE intitule = 'Gymnase Jean Bouin'
ON CONFLICT DO NOTHING;

INSERT INTO compteurs (batiment_id, fluide, reference_compteur, fournisseur, unite, annee_reference, conso_reference)
SELECT id, 'gaz', 'PCE-59220-002', 'ENGIE', 'm3', 2020, 22000
FROM batiments WHERE intitule = 'Gymnase Jean Bouin'
ON CONFLICT DO NOTHING;

INSERT INTO compteurs (batiment_id, fluide, reference_compteur, fournisseur, unite)
SELECT id, 'eau', 'CPT-GYM-001', 'Régie eau Denain', 'm3'
FROM batiments WHERE intitule = 'Gymnase Jean Bouin'
ON CONFLICT DO NOTHING;

-- ── Décret Tertiaire Gymnase ──────────────────────────────────────────────────
INSERT INTO decret_tertiaire (batiment_id, annee_reference, conso_ref_kwh, soumis_decret)
SELECT id, 2020, 344200, TRUE
FROM batiments WHERE intitule = 'Gymnase Jean Bouin'
ON CONFLICT (batiment_id) DO NOTHING;

-- ── Compteur Maison des Acacias ───────────────────────────────────────────────
INSERT INTO compteurs (batiment_id, fluide, reference_compteur, fournisseur, unite)
SELECT id, 'electricite', 'PDL-59220-003', 'EDF', 'kWh'
FROM batiments WHERE intitule ILIKE '%Acacias%'
ON CONFLICT DO NOTHING;

-- ── Compteurs armoires éclairage ─────────────────────────────────────────────
INSERT INTO compteurs (armoire_id, fluide, reference_compteur, fournisseur, unite)
SELECT id, 'electricite', 'PDL-EP-001', 'Enedis', 'kWh'
FROM armoires_eclairage WHERE intitule LIKE 'ARM-01%'
ON CONFLICT DO NOTHING;

INSERT INTO compteurs (armoire_id, fluide, reference_compteur, fournisseur, unite)
SELECT id, 'electricite', 'PDL-EP-002', 'Enedis', 'kWh'
FROM armoires_eclairage WHERE intitule LIKE 'ARM-02%'
ON CONFLICT DO NOTHING;

-- ── Relevés Hôtel de Ville — électricité 2024 ────────────────────────────────
WITH cpt AS (SELECT id FROM compteurs WHERE reference_compteur = 'PDL-59220-001' LIMIT 1)
INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source) VALUES
  ((SELECT id FROM cpt), '2024-01-01', 14200, 2272, 'manuel'),
  ((SELECT id FROM cpt), '2024-02-01', 13100, 2096, 'manuel'),
  ((SELECT id FROM cpt), '2024-03-01', 11800, 1888, 'manuel'),
  ((SELECT id FROM cpt), '2024-04-01',  9200, 1472, 'manuel'),
  ((SELECT id FROM cpt), '2024-05-01',  7800, 1248, 'manuel'),
  ((SELECT id FROM cpt), '2024-06-01',  7200, 1152, 'manuel'),
  ((SELECT id FROM cpt), '2024-07-01',  6900, 1104, 'manuel'),
  ((SELECT id FROM cpt), '2024-08-01',  5800,  928, 'manuel'),
  ((SELECT id FROM cpt), '2024-09-01',  8100, 1296, 'manuel'),
  ((SELECT id FROM cpt), '2024-10-01', 11200, 1792, 'manuel'),
  ((SELECT id FROM cpt), '2024-11-01', 13400, 2144, 'manuel'),
  ((SELECT id FROM cpt), '2024-12-01', 14300, 2288, 'manuel')
ON CONFLICT (compteur_id, periode) DO NOTHING;

-- ── Relevés Hôtel de Ville — gaz 2024 ────────────────────────────────────────
WITH cpt AS (SELECT id FROM compteurs WHERE reference_compteur = 'PCE-59220-001' LIMIT 1)
INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source) VALUES
  ((SELECT id FROM cpt), '2024-01-01', 2800, 2240, 'manuel'),
  ((SELECT id FROM cpt), '2024-02-01', 2600, 2080, 'manuel'),
  ((SELECT id FROM cpt), '2024-03-01', 1900, 1520, 'manuel'),
  ((SELECT id FROM cpt), '2024-04-01',  800,  640, 'manuel'),
  ((SELECT id FROM cpt), '2024-05-01',  200,  160, 'manuel'),
  ((SELECT id FROM cpt), '2024-06-01',   50,   40, 'manuel'),
  ((SELECT id FROM cpt), '2024-07-01',   50,   40, 'manuel'),
  ((SELECT id FROM cpt), '2024-08-01',   50,   40, 'manuel'),
  ((SELECT id FROM cpt), '2024-09-01',  300,  240, 'manuel'),
  ((SELECT id FROM cpt), '2024-10-01', 1400, 1120, 'manuel'),
  ((SELECT id FROM cpt), '2024-11-01', 2200, 1760, 'manuel'),
  ((SELECT id FROM cpt), '2024-12-01', 2700, 2160, 'manuel')
ON CONFLICT (compteur_id, periode) DO NOTHING;

-- ── Relevés armoire ARM-01 — électricité 2024 ────────────────────────────────
WITH cpt AS (SELECT id FROM compteurs WHERE reference_compteur = 'PDL-EP-001' LIMIT 1)
INSERT INTO releves_consommation (compteur_id, periode, consommation, montant_ht, source) VALUES
  ((SELECT id FROM cpt), '2024-01-01', 1820, 291, 'manuel'),
  ((SELECT id FROM cpt), '2024-02-01', 1680, 269, 'manuel'),
  ((SELECT id FROM cpt), '2024-03-01', 1420, 227, 'manuel'),
  ((SELECT id FROM cpt), '2024-04-01', 1100, 176, 'manuel'),
  ((SELECT id FROM cpt), '2024-05-01',  880, 141, 'manuel'),
  ((SELECT id FROM cpt), '2024-06-01',  760, 122, 'manuel'),
  ((SELECT id FROM cpt), '2024-07-01',  820, 131, 'manuel'),
  ((SELECT id FROM cpt), '2024-08-01',  940, 150, 'manuel'),
  ((SELECT id FROM cpt), '2024-09-01', 1150, 184, 'manuel'),
  ((SELECT id FROM cpt), '2024-10-01', 1560, 250, 'manuel'),
  ((SELECT id FROM cpt), '2024-11-01', 1740, 278, 'manuel'),
  ((SELECT id FROM cpt), '2024-12-01', 1930, 309, 'manuel')
ON CONFLICT (compteur_id, periode) DO NOTHING;

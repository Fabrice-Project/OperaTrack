-- ============================================================
-- OpéraTrack — Seed Data
-- Ville de Denain — 6 opérations + 4 comptes utilisateurs
-- ============================================================
-- ÉTAPE 1 : Créer les utilisateurs dans Supabase Auth Dashboard
-- ou via la fonction below (nécessite service_role)
-- ============================================================

-- Note : Les utilisateurs doivent être créés via l'API Supabase Auth.
-- Ce fichier contient le seed SQL pour les opérations une fois les
-- utilisateurs créés. Voir /server/db/seed-users.js pour la création
-- des comptes via l'API.

-- ============================================================
-- OPÉRATIONS (à exécuter après création des utilisateurs)
-- Remplacer les UUIDs par ceux générés par Supabase Auth
-- ============================================================

-- Récupérer les UUIDs des utilisateurs
-- SELECT id, email FROM auth.users WHERE email IN (
--   'sophie.marchand@denain.fr',
--   'thomas.duval@denain.fr'
-- );

-- ============================================================
-- INSERTION DES 6 OPÉRATIONS
-- ============================================================

-- Les variables suivantes doivent être remplacées par les vrais UUIDs :
-- :sophie_id → UUID de sophie.marchand@denain.fr
-- :thomas_id → UUID de thomas.duval@denain.fr

-- Opération 1 — Maison de quartier des Acacias
INSERT INTO operations (
  intitule, type, statut, adresse, description,
  charged_id, maitre_oeuvre,
  enveloppe_ht, mode_financier, montant_engage, montant_mandate,
  date_debut, date_livraison_prev,
  latitude, longitude
) VALUES (
  'Maison de quartier des Acacias',
  'construction_neuve',
  'travaux',
  'Rue des Acacias, 59220 Denain',
  'Construction d''une maison de quartier de 420 m² comprenant salle polyvalente, local associatif, sanitaires et bureau de permanence sociale. Structure ossature bois, toiture végétalisée. Retard de 6 semaines dû aux intempéries de janvier 2025.',
  (SELECT id FROM auth.users WHERE email = 'sophie.marchand@denain.fr' LIMIT 1),
  'Cabinet d''architecture Leroy & Associés, Valenciennes',
  1250000.00, 'ap_cp', 1187000.00, 724000.00,
  '2023-10-02', '2025-06-30',
  50.3268000, 3.3901000
);

-- Opération 2 — Crèche municipale Léon Blum
INSERT INTO operations (
  intitule, type, statut, adresse, description,
  charged_id, maitre_oeuvre,
  enveloppe_ht, mode_financier, montant_engage, montant_mandate,
  date_debut, date_livraison_prev,
  latitude, longitude
) VALUES (
  'Crèche municipale Léon Blum',
  'construction_neuve',
  'consultation',
  'Avenue Léon Blum, 59220 Denain',
  'Crèche de 40 berceaux sur 650 m², certifiée E3C1 (RE2020). Financée partiellement par la CAF du Nord (280 000 €) et la Région Hauts-de-France (150 000 €). Permis de construire déposé le 10/01/2025, en cours d''instruction.',
  (SELECT id FROM auth.users WHERE email = 'thomas.duval@denain.fr' LIMIT 1),
  'AIA Architectes, Lille',
  2100000.00, 'ap_cp', 187500.00, 62000.00,
  '2025-10-01', '2026-12-31',
  50.3245000, 3.3978000
);

-- Opération 3 — Rénovation énergétique de l'Hôtel de Ville
-- ALERTE ORANGE : GPA expirant dans ~58 jours (réception 12/09/2024 → fin GPA 12/09/2025)
INSERT INTO operations (
  intitule, type, statut, adresse, description,
  charged_id, maitre_oeuvre,
  enveloppe_ht, mode_financier, montant_engage, montant_mandate,
  date_debut, date_livraison_prev, date_reception,
  latitude, longitude
) VALUES (
  'Rénovation énergétique de l''Hôtel de Ville',
  'rehabilitation',
  'reception',
  'Place du Général de Gaulle, 59220 Denain',
  'Remplacement des menuiseries extérieures (double vitrage à isolation renforcée), isolation des combles, installation d''une centrale de traitement d''air. Gain énergétique estimé : -35 % sur la facture de chauffage. Bâtiment classé à l''inventaire du patrimoine. 1 réserve en cours (infiltration menuiserie nord).',
  (SELECT id FROM auth.users WHERE email = 'sophie.marchand@denain.fr' LIMIT 1),
  'BET Thermie Nord, Douai',
  780000.00, 'enveloppe_globale', 763200.00, 763200.00,
  '2023-09-01', '2024-09-30', '2024-09-12',
  50.3236000, 3.3952000
);

-- Opération 4 — Remise aux normes du gymnase Jean Bouin
-- ALERTE ROUGE : montant_engage (1 537 000) > enveloppe_ht (1 450 000) × 1.05 (1 522 500)
INSERT INTO operations (
  intitule, type, statut, adresse, description,
  charged_id, maitre_oeuvre,
  enveloppe_ht, mode_financier, montant_engage, montant_mandate,
  date_debut, date_livraison_prev,
  latitude, longitude
) VALUES (
  'Remise aux normes du gymnase Jean Bouin',
  'rehabilitation',
  'travaux',
  'Rue Jean Bouin, 59220 Denain',
  'Mise aux normes accessibilité PMR (ERP type X), remplacement du parquet sportif, mise en conformité électrique et éclairage LED, réfection des vestiaires. Découverte d''amiante dans les faux-plafonds — procédure SS4 engagée. Avenant de désamiantage +87 000 € HT.',
  (SELECT id FROM auth.users WHERE email = 'thomas.duval@denain.fr' LIMIT 1),
  'Atelier d''architecture sportive Lecomte, Cambrai',
  1450000.00, 'enveloppe_globale', 1537000.00, 890000.00,
  '2024-03-15', '2025-09-15',
  50.3251000, 3.3864000
);

-- Opération 5 — Requalification de la rue du Maréchal Foch
INSERT INTO operations (
  intitule, type, statut, adresse, description,
  charged_id, maitre_oeuvre,
  enveloppe_ht, mode_financier, montant_engage, montant_mandate,
  date_debut, date_livraison_prev,
  latitude, longitude
) VALUES (
  'Requalification de la rue du Maréchal Foch',
  'amenagement_vrd',
  'travaux',
  'Rue du Maréchal Foch, 59220 Denain',
  'Refonte complète de la voirie sur 420 ml : réfection de chaussée, réseaux EU/EP, création de trottoirs élargis en pavés, plantation d''arbres d''alignement, éclairage public LED et mobilier urbain. Coordination avec ENEDIS pour enfouissement réseau électrique.',
  (SELECT id FROM auth.users WHERE email = 'sophie.marchand@denain.fr' LIMIT 1),
  'Bureau d''études VRD Terrasol, Valenciennes',
  650000.00, 'enveloppe_globale', 621000.00, 310000.00,
  '2025-01-07', '2025-05-30',
  50.3229000, 3.3940000
);

-- Opération 6 — Aménagement du parvis de la gare
INSERT INTO operations (
  intitule, type, statut, adresse, description,
  charged_id, maitre_oeuvre,
  enveloppe_ht, mode_financier, montant_engage, montant_mandate,
  date_debut, date_livraison_prev,
  latitude, longitude
) VALUES (
  'Aménagement du parvis de la gare',
  'amenagement_vrd',
  'etudes',
  'Place de la Gare, 59220 Denain',
  'Requalification du parvis de la gare : espace piéton sécurisé, dépose-minute, parking vélos sécurisé, noues paysagères pour gestion des eaux pluviales, mobilier contemporain. Co-financé par SNCF Gares & Connexions et Région HdF (FEDER 120 000 €). S''inscrit dans le projet de revitalisation du centre-ville.',
  (SELECT id FROM auth.users WHERE email = 'thomas.duval@denain.fr' LIMIT 1),
  'Agence paysagère Végétal & Ville, Lille',
  890000.00, 'ap_cp', 89000.00, 22000.00,
  '2026-03-01', '2026-10-31',
  50.3197000, 3.3988000
);

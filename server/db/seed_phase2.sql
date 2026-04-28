-- ============================================================
-- OpéraTrack — Seed Data Phase 2
-- Marchés, avenants, OS et mouvements financiers
-- ============================================================

-- ============================================================
-- OPÉRATION 1 — Maison de quartier des Acacias
-- ============================================================

-- Marché travaux principal
INSERT INTO marches (operation_id, numero, intitule, type, procedure,
  titulaire_nom, titulaire_siret, montant_initial_ht, date_notification,
  delai_execution, statut)
VALUES (
  (SELECT id FROM operations WHERE intitule = 'Maison de quartier des Acacias'),
  '2023-001', 'Travaux de construction — lot unique', 'travaux', 'appel_offres_ouvert',
  'Entreprise Générale Bâti-Nord', '41234567800012', 987000, '2023-09-28',
  275, 'en_cours'
);

-- Avenant n°1
INSERT INTO avenants (marche_id, numero, objet, montant_ht, date_avenant)
VALUES (
  (SELECT id FROM marches WHERE numero = '2023-001'),
  1, 'Modification réseau électrique — adaptation tableau TGBT', 18400, '2024-02-15'
);

-- OS démarrage
INSERT INTO ordres_de_service (marche_id, numero, type, date_os, objet)
VALUES (
  (SELECT id FROM marches WHERE numero = '2023-001'),
  1, 'demarrage', '2023-10-02', 'Ordre de service de démarrage des travaux'
);

-- Marché maîtrise d'œuvre
INSERT INTO marches (operation_id, numero, intitule, type, procedure,
  titulaire_nom, montant_initial_ht, date_notification, statut)
VALUES (
  (SELECT id FROM operations WHERE intitule = 'Maison de quartier des Acacias'),
  '2022-018', 'Mission de maîtrise d''œuvre complète', 'maitrise_oeuvre', 'mapa',
  'Cabinet Leroy & Associés', 138000, '2022-11-14', 'en_cours'
);

-- Mouvements financiers — Opération 1
INSERT INTO mouvements_financiers (operation_id, type, libelle, montant, date_mouvement, reference) VALUES
  ((SELECT id FROM operations WHERE intitule = 'Maison de quartier des Acacias'),
   'engagement', 'Engagement marché MOE — Cabinet Leroy', 138000, '2022-11-14', 'ENG-2022-018'),
  ((SELECT id FROM operations WHERE intitule = 'Maison de quartier des Acacias'),
   'engagement', 'Engagement marché travaux — Bâti-Nord', 987000, '2023-09-28', 'ENG-2023-001'),
  ((SELECT id FROM operations WHERE intitule = 'Maison de quartier des Acacias'),
   'engagement', 'Engagement avenant n°1 réseau électrique', 18400, '2024-02-15', 'ENG-2023-001-AV1'),
  ((SELECT id FROM operations WHERE intitule = 'Maison de quartier des Acacias'),
   'mandatement', 'Acompte 30% travaux', 296100, '2023-11-30', 'FAC-2023-142'),
  ((SELECT id FROM operations WHERE intitule = 'Maison de quartier des Acacias'),
   'mandatement', 'Situation travaux n°2', 250000, '2024-03-15', 'FAC-2024-067'),
  ((SELECT id FROM operations WHERE intitule = 'Maison de quartier des Acacias'),
   'mandatement', 'Situation travaux n°3', 177900, '2024-09-20', 'FAC-2024-198');

-- CP annuels — Opération 1 (mode AP/CP)
INSERT INTO credits_paiement (operation_id, annee, montant_prevu, montant_mandate) VALUES
  ((SELECT id FROM operations WHERE intitule = 'Maison de quartier des Acacias'), 2023, 300000, 296100),
  ((SELECT id FROM operations WHERE intitule = 'Maison de quartier des Acacias'), 2024, 450000, 427900),
  ((SELECT id FROM operations WHERE intitule = 'Maison de quartier des Acacias'), 2025, 500000, 0);

-- ============================================================
-- OPÉRATION 2 — Crèche municipale Léon Blum
-- ============================================================
INSERT INTO credits_paiement (operation_id, annee, montant_prevu, montant_mandate) VALUES
  ((SELECT id FROM operations WHERE intitule = 'Crèche municipale Léon Blum'), 2025, 300000, 62000),
  ((SELECT id FROM operations WHERE intitule = 'Crèche municipale Léon Blum'), 2026, 900000, 0),
  ((SELECT id FROM operations WHERE intitule = 'Crèche municipale Léon Blum'), 2027, 900000, 0);

-- ============================================================
-- OPÉRATION 4 — Gymnase Jean Bouin (avec dépassement)
-- ============================================================

-- Marché travaux principal
INSERT INTO marches (operation_id, numero, intitule, type, procedure,
  titulaire_nom, titulaire_siret, montant_initial_ht, date_notification,
  delai_execution, statut)
VALUES (
  (SELECT id FROM operations WHERE intitule = 'Remise aux normes du gymnase Jean Bouin'),
  '2024-003', 'Travaux de réhabilitation — lot unique', 'travaux', 'appel_offres_ouvert',
  'Rénov''Sport Nord', '55678901200034', 1245000, '2024-03-10',
  185, 'en_cours'
);

-- Avenant désamiantage
INSERT INTO avenants (marche_id, numero, objet, montant_ht, date_avenant, commentaire)
VALUES (
  (SELECT id FROM marches WHERE numero = '2024-003'),
  1, 'Travaux de désamiantage faux-plafonds — procédure SS4', 87000, '2024-07-22',
  'Découverte amiante lors du diagnostic approfondi en phase travaux'
);

-- OS arrêt et reprise
INSERT INTO ordres_de_service (marche_id, numero, type, date_os, objet) VALUES
  ((SELECT id FROM marches WHERE numero = '2024-003'), 1, 'demarrage', '2024-03-15', 'OS de démarrage des travaux de réhabilitation'),
  ((SELECT id FROM marches WHERE numero = '2024-003'), 2, 'arret', '2025-01-18', 'Arrêt du chantier pour désamiantage — sécurisation du site'),
  ((SELECT id FROM marches WHERE numero = '2024-003'), 3, 'reprise', '2025-02-08', 'Reprise des travaux après validation du rapport de désamiantage');

-- Mouvements financiers — Opération 4
INSERT INTO mouvements_financiers (operation_id, type, libelle, montant, date_mouvement, reference) VALUES
  ((SELECT id FROM operations WHERE intitule = 'Remise aux normes du gymnase Jean Bouin'),
   'engagement', 'Engagement marché travaux — Rénov''Sport Nord', 1245000, '2024-03-10', 'ENG-2024-003'),
  ((SELECT id FROM operations WHERE intitule = 'Remise aux normes du gymnase Jean Bouin'),
   'engagement', 'Engagement avenant n°1 désamiantage SS4', 87000, '2024-07-22', 'ENG-2024-003-AV1'),
  ((SELECT id FROM operations WHERE intitule = 'Remise aux normes du gymnase Jean Bouin'),
   'mandatement', 'Acompte 40% travaux', 498000, '2024-06-30', 'FAC-2024-112'),
  ((SELECT id FROM operations WHERE intitule = 'Remise aux normes du gymnase Jean Bouin'),
   'mandatement', 'Situation travaux n°2', 250000, '2024-10-31', 'FAC-2024-221'),
  ((SELECT id FROM operations WHERE intitule = 'Remise aux normes du gymnase Jean Bouin'),
   'mandatement', 'Désamiantage — décompte final', 142000, '2025-02-15', 'FAC-2025-031');

-- ============================================================
-- OPÉRATION 5 — Rue du Maréchal Foch
-- ============================================================
INSERT INTO marches (operation_id, numero, intitule, type, procedure,
  titulaire_nom, montant_initial_ht, date_notification, delai_execution, statut)
VALUES
  ((SELECT id FROM operations WHERE intitule = 'Requalification de la rue du Maréchal Foch'),
   '2024-021', 'Lot 1 — Terrassement et VRD', 'travaux', 'appel_offres_ouvert',
   'Colas Nord', 498000, '2024-12-15', 140, 'en_cours'),
  ((SELECT id FROM operations WHERE intitule = 'Requalification de la rue du Maréchal Foch'),
   '2024-022', 'Lot 2 — Signalisation et mobilier urbain', 'travaux', 'mapa',
   'Urba''Déco SAS', 78000, '2024-12-15', 120, 'en_cours');

INSERT INTO ordres_de_service (marche_id, numero, type, date_os, objet) VALUES
  ((SELECT id FROM marches WHERE numero = '2024-021'), 1, 'demarrage', '2025-01-07', 'OS de démarrage Lot 1 — VRD'),
  ((SELECT id FROM marches WHERE numero = '2024-022'), 1, 'demarrage', '2025-01-14', 'OS de démarrage Lot 2 — mobilier urbain');

INSERT INTO mouvements_financiers (operation_id, type, libelle, montant, date_mouvement, reference) VALUES
  ((SELECT id FROM operations WHERE intitule = 'Requalification de la rue du Maréchal Foch'),
   'engagement', 'Engagement Lot 1 VRD — Colas Nord', 498000, '2024-12-15', 'ENG-2024-021'),
  ((SELECT id FROM operations WHERE intitule = 'Requalification de la rue du Maréchal Foch'),
   'engagement', 'Engagement Lot 2 mobilier — Urba''Déco', 78000, '2024-12-15', 'ENG-2024-022'),
  ((SELECT id FROM operations WHERE intitule = 'Requalification de la rue du Maréchal Foch'),
   'mandatement', 'Acompte démarrage Lot 1', 200000, '2025-02-15', 'FAC-2025-044'),
  ((SELECT id FROM operations WHERE intitule = 'Requalification de la rue du Maréchal Foch'),
   'mandatement', 'Acompte démarrage Lot 2', 110000, '2025-02-20', 'FAC-2025-048');

-- ============================================================
-- Recalcul montant_actuel_ht pour tous les marchés
-- ============================================================
UPDATE marches m SET
  montant_actuel_ht = m.montant_initial_ht + COALESCE(
    (SELECT SUM(a.montant_ht) FROM avenants a WHERE a.marche_id = m.id), 0
  ),
  date_fin_prev = CASE
    WHEN m.date_notification IS NOT NULL AND m.delai_execution IS NOT NULL
    THEN m.date_notification + (m.delai_execution || ' days')::INTERVAL
    ELSE NULL
  END;

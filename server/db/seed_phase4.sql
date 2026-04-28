-- ============================================================
-- Seed Phase 4 — Réception, Résilience, Mandat
-- ============================================================

-- ── RESERVES — Hôtel de Ville ────────────────────────────────
INSERT INTO reserves (operation_id, numero, description, lot_concerne, responsable, delai_levee, date_levee, statut) VALUES
  ('0cfba54e-046a-4b47-9787-027840692753', 1, 'Infiltration au niveau de la menuiserie côté nord — joint à reprendre', 'Lot menuiseries extérieures', 'Alu-Nord SARL', '2025-03-15', NULL, 'ouverte'),
  ('0cfba54e-046a-4b47-9787-027840692753', 2, 'Reprise peinture cage escalier principal — traces de coffrage visibles', 'Lot peinture intérieure', 'Couleurs & Co', '2025-01-31', '2025-01-28', 'levee'),
  ('0cfba54e-046a-4b47-9787-027840692753', 3, 'Ajustement ferme-porte bureau direction — fermeture incomplète', 'Lot serrurerie', 'Métal-Pro Nord', '2025-01-15', '2025-01-10', 'levee');

-- ── RESILIENCE — mise à jour des 6 opérations ────────────────
UPDATE operations SET
  resilience_v1 = 'significatif', resilience_v2 = 'partiel',
  resilience_v3 = 'significatif', resilience_v4 = 'partiel',
  resilience_commentaire = 'Structure ossature bois (faible empreinte carbone), toiture végétalisée (gestion EP + îlot fraîcheur), confort d''usage optimisé pour les associations.',
  financements_resilience = 'Aucun financement spécifique résilience mobilisé sur cette opération.'
WHERE id = '19924f5f-cee9-40d7-9971-00b5640bf388';

UPDATE operations SET
  resilience_v1 = 'partiel', resilience_v2 = 'structurant',
  resilience_v3 = 'structurant', resilience_v4 = 'significatif',
  resilience_commentaire = 'Certification E3C1 (RE2020) — performance énergétique exemplaire. Protection renforcée des jeunes enfants (confort thermique été/hiver). Éligible Fonds vert volet rénovation.',
  financements_resilience = 'CAF du Nord : 280 000 € (dont volet adaptation climatique). Dossier Fonds vert en cours de montage.'
WHERE id = '94c2bee5-f9b4-412b-aa13-221d2b6597cd';

UPDATE operations SET
  resilience_v1 = 'non_concerne', resilience_v2 = 'structurant',
  resilience_v3 = 'significatif', resilience_v4 = 'structurant',
  resilience_commentaire = 'Opération 100% centrée sur la performance énergétique : menuiseries VIR, isolation combles, CTA. Gain -35% sur facture chauffage. Bâtiment administratif classé : contraintes patrimoine prises en compte.',
  financements_resilience = 'ADEME — CEE (Certificats d''Économie d''Énergie) : 22 000 € perçus.'
WHERE id = '0cfba54e-046a-4b47-9787-027840692753';

UPDATE operations SET
  resilience_v1 = 'non_concerne', resilience_v2 = 'partiel',
  resilience_v3 = 'structurant', resilience_v4 = 'partiel',
  resilience_commentaire = 'Mise aux normes PMR (accessibilité universelle), éclairage LED performant. Volet climatique non applicable (bâtiment existant en milieu urbain dense). Désamiantage : amélioration qualité air intérieur.',
  financements_resilience = 'Aucun financement résilience spécifique. Financement de droit commun.'
WHERE id = '2ca57a01-adaa-4db0-a497-ec946da1bcba';

UPDATE operations SET
  resilience_v1 = 'structurant', resilience_v2 = 'significatif',
  resilience_v3 = 'significatif', resilience_v4 = 'significatif',
  resilience_commentaire = 'Requalification urbaine exemplaire : trottoirs élargis, plantation d''arbres d''alignement (trame verte), éclairage LED, enfouissement réseau. Impact fort sur désimperméabilisation et cadre de vie.',
  financements_resilience = 'Agence de l''eau Artois-Picardie : 35 000 € (gestion EP). DSIL — volet transition écologique : 120 000 €.'
WHERE id = '83ea1eed-4161-4665-8de5-786bd839cd29';

UPDATE operations SET
  resilience_v1 = 'structurant', resilience_v2 = 'partiel',
  resilience_v3 = 'structurant', resilience_v4 = 'significatif',
  resilience_commentaire = 'Projet phare de la stratégie résilience : noues paysagères (gestion EP naturelle), espace piéton sécurisé, parking vélos. Contribue à la revitalisation centre-ville et à la mobilité douce.',
  financements_resilience = 'FEDER Hauts-de-France (Région) : 120 000 €. SNCF Gares & Connexions : convention de co-financement signée.'
WHERE id = 'cf136e12-a751-445c-97e9-0bdf643524b1';

-- ── ENGAGEMENTS DE MANDAT ────────────────────────────────────
INSERT INTO engagements_mandat (intitule, cible, unite, date_echeance, ordre) VALUES
  ('Planter 200 arbres d''alignement sur le territoire', 200, 'arbres', '2026-12-31', 1),
  ('Rénover 3 équipements sportifs aux normes PMR', 3, 'équipements', '2026-06-30', 2),
  ('Réduire de 30% la facture énergétique des bâtiments communaux', 30, '%', '2026-12-31', 3),
  ('Créer 2 nouveaux équipements de proximité', 2, 'équipements', '2026-12-31', 4),
  ('Réaménager 3 espaces publics majeurs', 3, 'espaces', '2026-12-31', 5);

-- ── ASSOCIATIONS OPÉRATIONS ↔ ENGAGEMENTS ───────────────────
INSERT INTO operation_engagements (operation_id, engagement_id, contribution)
SELECT '83ea1eed-4161-4665-8de5-786bd839cd29', id, 40
FROM engagements_mandat WHERE intitule LIKE 'Planter%';

INSERT INTO operation_engagements (operation_id, engagement_id, contribution)
SELECT 'cf136e12-a751-445c-97e9-0bdf643524b1', id, 70
FROM engagements_mandat WHERE intitule LIKE 'Planter%';

INSERT INTO operation_engagements (operation_id, engagement_id, contribution)
SELECT '2ca57a01-adaa-4db0-a497-ec946da1bcba', id, 1
FROM engagements_mandat WHERE intitule LIKE 'Rénover%';

INSERT INTO operation_engagements (operation_id, engagement_id, contribution)
SELECT '19924f5f-cee9-40d7-9971-00b5640bf388', id, 1
FROM engagements_mandat WHERE intitule LIKE 'Créer%';

INSERT INTO operation_engagements (operation_id, engagement_id, contribution)
SELECT '94c2bee5-f9b4-412b-aa13-221d2b6597cd', id, 1
FROM engagements_mandat WHERE intitule LIKE 'Créer%';

INSERT INTO operation_engagements (operation_id, engagement_id, contribution)
SELECT '83ea1eed-4161-4665-8de5-786bd839cd29', id, 1
FROM engagements_mandat WHERE intitule LIKE 'Réaménager%';

INSERT INTO operation_engagements (operation_id, engagement_id, contribution)
SELECT 'cf136e12-a751-445c-97e9-0bdf643524b1', id, 1
FROM engagements_mandat WHERE intitule LIKE 'Réaménager%';

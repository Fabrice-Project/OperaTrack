-- ============================================================
-- Seed Phase 3 — Jalons des 6 opérations (UUIDs hardcodés)
-- ============================================================
-- Maison de quartier des Acacias    : 19924f5f-cee9-40d7-9971-00b5640bf388
-- Crèche Léon Blum                  : 94c2bee5-f9b4-412b-aa13-221d2b6597cd
-- Hôtel de Ville                    : 0cfba54e-046a-4b47-9787-027840692753
-- Gymnase Jean Bouin                : 2ca57a01-adaa-4db0-a497-ec946da1bcba
-- Rue du Maréchal Foch              : 83ea1eed-4161-4665-8de5-786bd839cd29
-- Parvis de la gare                 : cf136e12-a751-445c-97e9-0bdf643524b1

-- OP 1 — Maison de quartier des Acacias (construction neuve, réception en retard)
INSERT INTO jalons (operation_id, intitule, ordre, date_prevue, date_reelle, commentaire) VALUES
('19924f5f-cee9-40d7-9971-00b5640bf388','Programme validé',            1,'2022-03-14','2022-03-14',NULL),
('19924f5f-cee9-40d7-9971-00b5640bf388','Permis de construire déposé', 2,'2023-01-10','2023-01-10',NULL),
('19924f5f-cee9-40d7-9971-00b5640bf388','Permis de construire obtenu', 3,'2023-03-08','2023-03-14','Légère instruction complémentaire demandée'),
('19924f5f-cee9-40d7-9971-00b5640bf388','DCE validé',                  4,'2023-06-15','2023-06-20',NULL),
('19924f5f-cee9-40d7-9971-00b5640bf388','Marché notifié',              5,'2023-09-15','2023-09-28',NULL),
('19924f5f-cee9-40d7-9971-00b5640bf388','OS de démarrage',             6,'2023-10-02','2023-10-02',NULL),
('19924f5f-cee9-40d7-9971-00b5640bf388','Réception / DOE',             7,'2025-06-30',NULL,'Retard de 6 semaines — intempéries janvier 2025'),
('19924f5f-cee9-40d7-9971-00b5640bf388','Fin GPA',                     8,NULL,NULL,NULL);

-- OP 2 — Crèche Léon Blum (construction neuve, en cours, dans les délais)
INSERT INTO jalons (operation_id, intitule, ordre, date_prevue, date_reelle, commentaire) VALUES
('94c2bee5-f9b4-412b-aa13-221d2b6597cd','Programme validé',            1,'2024-06-01','2024-06-01',NULL),
('94c2bee5-f9b4-412b-aa13-221d2b6597cd','Permis de construire déposé', 2,'2025-01-10','2025-01-10',NULL),
('94c2bee5-f9b4-412b-aa13-221d2b6597cd','Permis de construire obtenu', 3,'2025-04-15',NULL,'Instruction en cours — délai estimé 3 mois'),
('94c2bee5-f9b4-412b-aa13-221d2b6597cd','DCE validé',                  4,'2025-07-01',NULL,NULL),
('94c2bee5-f9b4-412b-aa13-221d2b6597cd','Marché notifié',              5,'2025-09-01',NULL,NULL),
('94c2bee5-f9b4-412b-aa13-221d2b6597cd','OS de démarrage',             6,'2025-10-01',NULL,NULL),
('94c2bee5-f9b4-412b-aa13-221d2b6597cd','Réception / DOE',             7,'2026-12-31',NULL,NULL),
('94c2bee5-f9b4-412b-aa13-221d2b6597cd','Fin GPA',                     8,'2027-12-31',NULL,NULL);

-- OP 3 — Hôtel de Ville (réhabilitation, réceptionnée, GPA en cours)
INSERT INTO jalons (operation_id, intitule, ordre, date_prevue, date_reelle, commentaire) VALUES
('0cfba54e-046a-4b47-9787-027840692753','Diagnostic validé',1,'2022-12-01','2022-12-01',NULL),
('0cfba54e-046a-4b47-9787-027840692753','DCE validé',       2,'2023-04-01','2023-04-05',NULL),
('0cfba54e-046a-4b47-9787-027840692753','Marché notifié',   3,'2023-06-01','2023-06-12',NULL),
('0cfba54e-046a-4b47-9787-027840692753','OS de démarrage',  4,'2023-09-01','2023-09-04',NULL),
('0cfba54e-046a-4b47-9787-027840692753','Réception',        5,'2024-09-30','2024-09-12','Réception prononcée avec 18 jours d''avance'),
('0cfba54e-046a-4b47-9787-027840692753','Fin GPA',          6,'2025-09-12',NULL,'Alerte : 1 réserve non levée (infiltration menuiserie nord)');

-- OP 4 — Gymnase Jean Bouin (réhabilitation, travaux, retard)
INSERT INTO jalons (operation_id, intitule, ordre, date_prevue, date_reelle, commentaire) VALUES
('2ca57a01-adaa-4db0-a497-ec946da1bcba','Diagnostic validé',1,'2023-09-01','2023-09-15',NULL),
('2ca57a01-adaa-4db0-a497-ec946da1bcba','DCE validé',       2,'2023-12-01','2023-12-10',NULL),
('2ca57a01-adaa-4db0-a497-ec946da1bcba','Marché notifié',   3,'2024-03-01','2024-03-10',NULL),
('2ca57a01-adaa-4db0-a497-ec946da1bcba','OS de démarrage',  4,'2024-03-15','2024-03-15',NULL),
('2ca57a01-adaa-4db0-a497-ec946da1bcba','Réception',        5,'2025-09-15',NULL,'Arrêt chantier 3 semaines — désamiantage SS4.'),
('2ca57a01-adaa-4db0-a497-ec946da1bcba','Fin GPA',          6,NULL,NULL,NULL);

-- OP 5 — Rue du Maréchal Foch (VRD, travaux en cours)
INSERT INTO jalons (operation_id, intitule, ordre, date_prevue, date_reelle, commentaire) VALUES
('83ea1eed-4161-4665-8de5-786bd839cd29','Études préalables validées',1,'2024-06-01','2024-06-01',NULL),
('83ea1eed-4161-4665-8de5-786bd839cd29','Marché notifié',            2,'2024-12-01','2024-12-15',NULL),
('83ea1eed-4161-4665-8de5-786bd839cd29','OS de démarrage',           3,'2025-01-07','2025-01-07',NULL),
('83ea1eed-4161-4665-8de5-786bd839cd29','Réception',                 4,'2025-05-30',NULL,NULL),
('83ea1eed-4161-4665-8de5-786bd839cd29','Fin GPA',                   5,'2026-05-30',NULL,NULL);

-- OP 6 — Parvis de la gare (VRD, études)
INSERT INTO jalons (operation_id, intitule, ordre, date_prevue, date_reelle, commentaire) VALUES
('cf136e12-a751-445c-97e9-0bdf643524b1','Études préalables validées',1,'2025-04-30',NULL,'Validation APS prévue le 30/04/2025'),
('cf136e12-a751-445c-97e9-0bdf643524b1','Enquête publique',          2,'2025-09-01',NULL,NULL),
('cf136e12-a751-445c-97e9-0bdf643524b1','Marché notifié',            3,'2026-01-15',NULL,NULL),
('cf136e12-a751-445c-97e9-0bdf643524b1','OS de démarrage',           4,'2026-03-01',NULL,NULL),
('cf136e12-a751-445c-97e9-0bdf643524b1','Réception',                 5,'2026-10-31',NULL,NULL),
('cf136e12-a751-445c-97e9-0bdf643524b1','Fin GPA',                   6,'2027-10-31',NULL,NULL);

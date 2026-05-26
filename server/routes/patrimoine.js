const express = require('express');
const multer = require('multer');
const uploadMem = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const { authenticate, requireRole,
        requirePatrimoineReferentielWrite,
        requirePatrimoineCoutsWrite } = require('../middleware/auth');
const ctrl  = require('../controllers/patrimoineController');
const ectrl = require('../controllers/energieController');

const router = express.Router();
router.use(authenticate);

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard', ctrl.getDashboard);

// ── Voirie — Tronçons ─────────────────────────────────────────────────────────
router.get('/voirie', ctrl.getVoirie);
router.post('/voirie', requirePatrimoineReferentielWrite, ctrl.createTroncon);

// ── Voirie — Vue interventions par catégorie ──────────────────────────────────
router.get('/voirie/interventions-voirie', ctrl.getVoirieInterventions);

// ── Voirie — Marchés (avant /:id pour éviter le conflit) ─────────────────────
router.get('/voirie/marches', ctrl.getMarches);
router.post('/voirie/marches', requirePatrimoineReferentielWrite, ctrl.createMarche);
router.get('/voirie/marches/:marcheId', ctrl.getMarche);
router.put('/voirie/marches/:marcheId', requirePatrimoineReferentielWrite, ctrl.updateMarche);
router.delete('/voirie/marches/:marcheId', requireRole('admin'), ctrl.deleteMarche);
router.post('/voirie/marches/:marcheId/engagements', requirePatrimoineReferentielWrite, ctrl.upsertEngagement);
router.delete('/voirie/engagements/:engId', requireRole('admin'), ctrl.deleteEngagement);

// ── Voirie — Mobilier urbain ──────────────────────────────────────────────────
router.get('/voirie/:tronconId/mobilier', ctrl.getMobilier);
router.post('/voirie/:tronconId/mobilier', requirePatrimoineReferentielWrite, ctrl.createMobilier);
router.put('/mobilier/:id', requirePatrimoineReferentielWrite, ctrl.updateMobilier);
router.delete('/mobilier/:id', requireRole('admin'), ctrl.deleteMobilier);

router.get('/voirie/:id', ctrl.getTroncon);
router.put('/voirie/:id', requirePatrimoineReferentielWrite, ctrl.updateTroncon);
router.delete('/voirie/:id', requireRole('admin'), ctrl.deleteTroncon);

// ── Éclairage — Armoires ──────────────────────────────────────────────────────
router.get('/eclairage/kpis', ctrl.getEclairageKpis);
router.get('/eclairage/armoires', ctrl.getArmoires);
router.post('/eclairage/armoires', requirePatrimoineReferentielWrite, ctrl.createArmoire);
router.get('/eclairage/armoires/:id', ctrl.getArmoire);
router.put('/eclairage/armoires/:id', requirePatrimoineReferentielWrite, ctrl.updateArmoire);

// ── Éclairage — Points lumineux ───────────────────────────────────────────────
router.get('/eclairage/points', ctrl.getPointsLumineux);
router.post('/eclairage/points', requirePatrimoineReferentielWrite, ctrl.createPointLumineux);
router.get('/eclairage/points/:id', ctrl.getPointLumineux);
router.put('/eclairage/points/:id', requirePatrimoineReferentielWrite, ctrl.updatePointLumineux);

// ── Feux tricolores — Armoires ────────────────────────────────────────────────
router.get('/feux/kpis',           ctrl.getFeuxKpis);
router.get('/feux/armoires',       ctrl.getArmoiresFeux);
router.post('/feux/armoires',      requirePatrimoineReferentielWrite, ctrl.createArmoireFeux);
router.get('/feux/armoires/:id',   ctrl.getArmoireFeux);
router.put('/feux/armoires/:id',   requirePatrimoineReferentielWrite, ctrl.updateArmoireFeux);

// ── Feux tricolores — Points feux ─────────────────────────────────────────────
router.get('/feux/points',         ctrl.getFeuxTricolores);
router.post('/feux/points',        requirePatrimoineReferentielWrite, ctrl.createFeuTricolore);
router.get('/feux/points/:id',     ctrl.getFeuTricolore);
router.put('/feux/points/:id',     requirePatrimoineReferentielWrite, ctrl.updateFeuTricolore);

// ── Équipements divers ────────────────────────────────────────────────────────
router.get('/equipements-divers/kpis',   ctrl.getEquipementsDiversKpis);
router.get('/equipements-divers',        ctrl.getEquipementsDivers);
router.post('/equipements-divers',       requirePatrimoineReferentielWrite, ctrl.createEquipementDivers);
router.get('/equipements-divers/:id',    ctrl.getEquipementDivers);
router.put('/equipements-divers/:id',    requirePatrimoineReferentielWrite, ctrl.updateEquipementDivers);
router.delete('/equipements-divers/:id', requirePatrimoineReferentielWrite, ctrl.deleteEquipementDivers);
router.get('/equipements-divers/:id/synthese-energie', ectrl.getSyntheseEnergieEquipement);

// ── Bâtiments ─────────────────────────────────────────────────────────────────
router.get('/batiments', ctrl.getBatiments);
router.post('/batiments', requirePatrimoineReferentielWrite, ctrl.createBatiment);
router.get('/batiments/:id', ctrl.getBatiment);
router.put('/batiments/:id', requirePatrimoineReferentielWrite, ctrl.updateBatiment);
router.get('/equipements', ctrl.getAllEquipements);
router.get('/batiments/:id/equipements', ctrl.getEquipements);
router.post('/batiments/:id/equipements', requirePatrimoineReferentielWrite, ctrl.createEquipement);
router.put('/equipements/:id', requirePatrimoineReferentielWrite, ctrl.updateEquipement);
router.delete('/equipements/:id', requirePatrimoineReferentielWrite, ctrl.deleteEquipement);

// ── Contrôles réglementaires (rattachés au bâtiment) ─────────────────────────
router.get('/batiments/:id/controles',    ctrl.getControlesBatiment);
router.post('/batiments/:id/controles',   requirePatrimoineReferentielWrite, ctrl.createControleBatiment);
router.put('/controles-batiment/:id',     requirePatrimoineReferentielWrite, ctrl.updateControleBatiment);
router.delete('/controles-batiment/:id',  requireRole('admin'), ctrl.deleteControleBatiment);

// ── Bilan interventions ───────────────────────────────────────────────────────
router.get('/bilan-interventions', ctrl.getBilanInterventions);

// ── Interventions ─────────────────────────────────────────────────────────────
router.get('/interventions', ctrl.getInterventions);
router.post('/interventions', requirePatrimoineCoutsWrite, ctrl.createIntervention);
router.get('/interventions/:id', ctrl.getIntervention);
router.put('/interventions/:id', requirePatrimoineCoutsWrite, ctrl.updateIntervention);
router.delete('/interventions/:id', requirePatrimoineCoutsWrite, ctrl.deleteIntervention);

// ── Énergie — Dashboard global ────────────────────────────────────────────────
router.get('/energie/dashboard', ectrl.getEnergieDashboard);
router.get('/energie/rapport',   ectrl.getRapportEnergie);

// ── Énergie — Compteurs ───────────────────────────────────────────────────────
router.get('/compteurs',     ectrl.getCompteurs);
router.post('/compteurs',    requirePatrimoineReferentielWrite, ectrl.createCompteur);
router.put('/compteurs/:id', requirePatrimoineReferentielWrite, ectrl.updateCompteur);
router.delete('/compteurs/:id', requireRole('admin'), ectrl.deleteCompteur);

// ── Énergie — Relevés ─────────────────────────────────────────────────────────
router.get('/compteurs/:id/releves',     ectrl.getReleves);
router.post('/compteurs/:id/releves',    requirePatrimoineCoutsWrite, ectrl.createReleve);
router.post('/compteurs/:id/import-csv', requirePatrimoineCoutsWrite, ectrl.importCSV);
router.put('/releves/:id',   requirePatrimoineCoutsWrite, ectrl.updateReleve);
router.delete('/releves/:id', requirePatrimoineCoutsWrite, ectrl.deleteReleve);

// ── Énergie — Synthèse par bâtiment / armoire ─────────────────────────────────
router.get('/batiments/:id/synthese-energie', ectrl.getSyntheseEnergieBatiment);
router.get('/armoires/:id/synthese-energie',  ectrl.getSyntheseEnergieArmoire);

// ── Énergie — Décret Tertiaire ────────────────────────────────────────────────
router.get('/batiments/:id/decret-tertiaire', ectrl.getDecretTertiaire);
router.put('/batiments/:id/decret-tertiaire', requirePatrimoineReferentielWrite, ectrl.upsertDecretTertiaire);

// ── Énergie — Exports ─────────────────────────────────────────────────────────
router.get('/exports/operat', ectrl.exportOperat);

// ── Documents Bâtiment ────────────────────────────────────────────────────────
router.get('/batiments/:id/docs', ctrl.getDocsBatiment);
router.post('/batiments/:id/docs', requirePatrimoineReferentielWrite, uploadMem.single('file'), ctrl.uploadDocBatiment);
router.get('/batiments/:id/docs/:docId/download', ctrl.downloadDocBatiment);
router.delete('/batiments/:id/docs/:docId', requirePatrimoineReferentielWrite, ctrl.deleteDocBatiment);
router.post('/batiments/:id/repertoires', requirePatrimoineReferentielWrite, ctrl.createRepertoireBatiment);
router.delete('/batiments/:id/repertoires/:repId', requirePatrimoineReferentielWrite, ctrl.deleteRepertoireBatiment);

module.exports = router;

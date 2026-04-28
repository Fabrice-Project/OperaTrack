const express = require('express');
const { authenticate, requireWriteAccess, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/patrimoineController');

const router = express.Router();
router.use(authenticate);

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard', ctrl.getDashboard);

// ── Voirie — Tronçons ─────────────────────────────────────────────────────────
router.get('/voirie', ctrl.getVoirie);
router.post('/voirie', requireWriteAccess, ctrl.createTroncon);

// ── Voirie — Vue interventions par catégorie ──────────────────────────────────
router.get('/voirie/interventions-voirie', ctrl.getVoirieInterventions);

// ── Voirie — Marchés (avant /:id pour éviter le conflit) ─────────────────────
router.get('/voirie/marches', ctrl.getMarches);
router.post('/voirie/marches', requireWriteAccess, ctrl.createMarche);
router.get('/voirie/marches/:marcheId', ctrl.getMarche);
router.put('/voirie/marches/:marcheId', requireWriteAccess, ctrl.updateMarche);
router.delete('/voirie/marches/:marcheId', requireRole('admin'), ctrl.deleteMarche);
router.post('/voirie/marches/:marcheId/engagements', requireWriteAccess, ctrl.upsertEngagement);
router.delete('/voirie/engagements/:engId', requireRole('admin'), ctrl.deleteEngagement);

// ── Voirie — Mobilier urbain ──────────────────────────────────────────────────
router.get('/voirie/:tronconId/mobilier', ctrl.getMobilier);
router.post('/voirie/:tronconId/mobilier', requireWriteAccess, ctrl.createMobilier);
router.put('/mobilier/:id', requireWriteAccess, ctrl.updateMobilier);
router.delete('/mobilier/:id', requireRole('admin'), ctrl.deleteMobilier);

router.get('/voirie/:id', ctrl.getTroncon);
router.put('/voirie/:id', requireWriteAccess, ctrl.updateTroncon);
router.delete('/voirie/:id', requireRole('admin'), ctrl.deleteTroncon);

// ── Éclairage — Armoires ──────────────────────────────────────────────────────
router.get('/eclairage/kpis', ctrl.getEclairageKpis);
router.get('/eclairage/armoires', ctrl.getArmoires);
router.post('/eclairage/armoires', requireWriteAccess, ctrl.createArmoire);
router.get('/eclairage/armoires/:id', ctrl.getArmoire);
router.put('/eclairage/armoires/:id', requireWriteAccess, ctrl.updateArmoire);

// ── Éclairage — Points lumineux ───────────────────────────────────────────────
router.get('/eclairage/points', ctrl.getPointsLumineux);
router.post('/eclairage/points', requireWriteAccess, ctrl.createPointLumineux);
router.get('/eclairage/points/:id', ctrl.getPointLumineux);
router.put('/eclairage/points/:id', requireWriteAccess, ctrl.updatePointLumineux);

// ── Bâtiments ─────────────────────────────────────────────────────────────────
router.get('/batiments', ctrl.getBatiments);
router.post('/batiments', requireWriteAccess, ctrl.createBatiment);
router.get('/batiments/:id', ctrl.getBatiment);
router.put('/batiments/:id', requireWriteAccess, ctrl.updateBatiment);
router.get('/equipements', ctrl.getAllEquipements);
router.get('/batiments/:id/equipements', ctrl.getEquipements);
router.post('/batiments/:id/equipements', requireWriteAccess, ctrl.createEquipement);
router.put('/equipements/:id', requireWriteAccess, ctrl.updateEquipement);
router.delete('/equipements/:id', requireWriteAccess, ctrl.deleteEquipement);

// ── Interventions ─────────────────────────────────────────────────────────────
router.get('/interventions', ctrl.getInterventions);
router.post('/interventions', requireWriteAccess, ctrl.createIntervention);
router.get('/interventions/:id', ctrl.getIntervention);
router.put('/interventions/:id', requireWriteAccess, ctrl.updateIntervention);
router.delete('/interventions/:id', requireRole('admin'), ctrl.deleteIntervention);

module.exports = router;

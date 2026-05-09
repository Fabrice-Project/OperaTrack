const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/demandesController');

const router = express.Router();
router.use(authenticate);

// Lecture : exploitant (ses demandes) + gestionnaire/admin (toutes)
router.get('/', ctrl.getDemandes);

// Création : tous les profils authentifiés (exploitant inclus)
router.post('/', ctrl.createDemande);

// Mise à jour statut/commentaire : gestionnaire patrimonial et admin uniquement
router.put('/:id', requireRole('admin', 'gestionnaire_patrimonial'), ctrl.updateDemande);

module.exports = router;

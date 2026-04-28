const express = require('express');
const { body } = require('express-validator');
const { authenticate, requireWriteAccess, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/marchesController');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const marcheValidation = [
  body('numero').notEmpty().withMessage('Numéro de marché requis'),
  body('intitule').notEmpty().withMessage('Intitulé requis'),
  body('type').isIn(['travaux', 'maitrise_oeuvre', 'controle', 'autre']).withMessage('Type invalide'),
  body('montant_initial_ht').isNumeric().withMessage('Montant invalide')
];

// Marchés d'une opération
router.get('/', ctrl.getByOperation);
router.post('/', requireWriteAccess, marcheValidation, ctrl.create);

module.exports = router;

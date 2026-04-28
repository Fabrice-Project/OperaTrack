const express = require('express');
const { body } = require('express-validator');
const { authenticate, requireWriteAccess } = require('../middleware/auth');
const ctrl = require('../controllers/financesController');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

// Synthèse financière
router.get('/finances', ctrl.getSynthese);

// Crédits de paiement
router.get('/credits-paiement', ctrl.getCreditsPaiement);
router.post('/credits-paiement',
  requireWriteAccess,
  [
    body('annee').isInt({ min: 2000, max: 2100 }).withMessage('Année invalide'),
    body('montant_prevu').isNumeric().withMessage('Montant prévu invalide')
  ],
  ctrl.upsertCreditPaiement
);
router.delete('/credits-paiement/:cpId', requireWriteAccess, ctrl.deleteCreditPaiement);

// Mouvements financiers
router.get('/mouvements', ctrl.getMouvements);
router.post('/mouvements',
  requireWriteAccess,
  [
    body('type').isIn(['engagement', 'mandatement']).withMessage('Type invalide'),
    body('libelle').notEmpty().withMessage('Libellé requis'),
    body('montant').isNumeric().withMessage('Montant invalide'),
    body('date_mouvement').isDate().withMessage('Date invalide')
  ],
  ctrl.createMouvement
);
router.delete('/mouvements/:mvtId', requireWriteAccess, ctrl.deleteMouvement);

module.exports = router;

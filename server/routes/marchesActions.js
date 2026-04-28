const express = require('express');
const { body } = require('express-validator');
const { authenticate, requireWriteAccess, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/marchesController');

const router = express.Router();
router.use(authenticate);

// Marché individuel
router.put('/:id', requireWriteAccess, ctrl.update);
router.delete('/:id', requireRole('admin', 'charge_operation'), ctrl.remove);

// Avenants
router.get('/:id/avenants', ctrl.getAvenants);
router.post('/:id/avenants',
  requireWriteAccess,
  [
    body('objet').notEmpty().withMessage('Objet requis'),
    body('montant_ht').isNumeric().withMessage('Montant invalide'),
    body('date_avenant').isDate().withMessage('Date invalide')
  ],
  ctrl.createAvenant
);

// Ordres de service
router.get('/:id/os', ctrl.getOS);
router.post('/:id/os',
  requireWriteAccess,
  [
    body('type').isIn(['demarrage', 'arret', 'reprise', 'modification', 'autre']).withMessage('Type OS invalide'),
    body('date_os').isDate().withMessage('Date invalide')
  ],
  ctrl.createOS
);

module.exports = router;

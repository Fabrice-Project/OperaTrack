const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');
const { authenticate, requireWriteAccess, requireModuleAWrite, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/operationsController');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const operationValidation = [
  body('intitule').notEmpty().withMessage('L\'intitulé est obligatoire'),
  body('type').isIn(['construction_neuve', 'rehabilitation', 'amenagement_vrd']).withMessage('Type invalide'),
  body('statut').isIn(['etudes', 'consultation', 'travaux', 'reception', 'soldee']).withMessage('Statut invalide'),
  body('enveloppe_ht').isNumeric().withMessage('L\'enveloppe HT doit être un nombre'),
  body('mode_financier').isIn(['enveloppe_globale', 'ap_cp']).withMessage('Mode financier invalide')
];

router.use(authenticate);

router.get('/kpis', ctrl.getKPIs);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', requireModuleAWrite, operationValidation, ctrl.create);
router.put('/:id', requireModuleAWrite, operationValidation, ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);
router.post('/:id/image', requireModuleAWrite, upload.single('image'), ctrl.uploadImage);
router.get('/:id/charges', ctrl.getCharges);
router.put('/:id/charges', requireModuleAWrite, ctrl.updateCharges);

module.exports = router;

const express = require('express');
const { authenticate, requireWriteAccess } = require('../middleware/auth');
const ctrl = require('../controllers/financementsController');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

router.get('/financements', ctrl.getFinancements);
router.post('/financements', requireWriteAccess, ctrl.createFinancement);
router.put('/financements/:financementId', requireWriteAccess, ctrl.updateFinancement);
router.delete('/financements/:financementId', requireWriteAccess, ctrl.deleteFinancement);

module.exports = router;

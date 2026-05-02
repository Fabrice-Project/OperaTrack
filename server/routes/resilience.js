const express = require('express');
const { authenticate, requireWriteAccess, requireStrategicWrite, blockCompta } = require('../middleware/auth');
const ctrl = require('../controllers/resilienceController');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

// Leviers (admin settings)
router.get('/leviers-resilience', ctrl.getLeviers);
router.post('/leviers-resilience', requireStrategicWrite, ctrl.createLevier);
router.put('/leviers-resilience/:levierId', requireStrategicWrite, ctrl.updateLevier);

// Par opération (résilience bloquée pour compta)
router.get('/resilience', blockCompta, ctrl.getResilience);
router.put('/resilience', blockCompta, requireWriteAccess, ctrl.updateResilience);
router.put('/engagements', requireWriteAccess, ctrl.updateOperationEngagements);

module.exports = router;

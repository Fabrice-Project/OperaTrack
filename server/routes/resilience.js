const express = require('express');
const { authenticate, requireWriteAccess, blockCompta } = require('../middleware/auth');
const ctrl = require('../controllers/resilienceController');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

// Leviers (admin settings)
router.get('/leviers-resilience', ctrl.getLeviers);
router.post('/leviers-resilience', requireWriteAccess, ctrl.createLevier);
router.put('/leviers-resilience/:levierId', requireWriteAccess, ctrl.updateLevier);

// Par opération (résilience bloquée pour compta)
router.get('/resilience', blockCompta, ctrl.getResilience);
router.put('/resilience', blockCompta, requireWriteAccess, ctrl.updateResilience);
router.put('/engagements', requireWriteAccess, ctrl.updateOperationEngagements);

module.exports = router;

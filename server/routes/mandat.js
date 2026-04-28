const express = require('express');
const { authenticate, requireWriteAccess } = require('../middleware/auth');
const ctrl = require('../controllers/resilienceController');

const router = express.Router();
router.use(authenticate);

router.get('/dashboard', ctrl.getMandatDashboard);
router.get('/engagements', ctrl.getEngagements);
router.post('/engagements', requireWriteAccess, ctrl.createEngagement);
router.put('/engagements/:engagementId', requireWriteAccess, ctrl.updateEngagement);
router.delete('/engagements/:engagementId', requireWriteAccess, ctrl.deleteEngagement);

module.exports = router;

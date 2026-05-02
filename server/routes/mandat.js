const express = require('express');
const { authenticate, requireStrategicWrite } = require('../middleware/auth');
const ctrl = require('../controllers/resilienceController');

const router = express.Router();
router.use(authenticate);

router.get('/dashboard', ctrl.getMandatDashboard);
router.get('/engagements', ctrl.getEngagements);
router.post('/engagements', requireStrategicWrite, ctrl.createEngagement);
router.put('/engagements/:engagementId', requireStrategicWrite, ctrl.updateEngagement);
router.delete('/engagements/:engagementId', requireStrategicWrite, ctrl.deleteEngagement);

module.exports = router;

const express = require('express');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/exportsController');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

router.get('/exports/finances', ctrl.exportFinancesOperation);
router.get('/exports/marches', ctrl.exportMarchesOperation);
router.get('/exports/planning', ctrl.exportPlanningOperation);

module.exports = router;

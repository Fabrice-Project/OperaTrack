const express = require('express');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/exportsController');

const router = express.Router();
router.use(authenticate);

router.get('/finances', ctrl.exportFinancesGlobal);
router.get('/marches', ctrl.exportMarchesGlobal);

module.exports = router;

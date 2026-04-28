const express = require('express');
const { authenticate, requireWriteAccess } = require('../middleware/auth');
const ctrl = require('../controllers/marchesController');

const router = express.Router();
router.use(authenticate);
router.delete('/:id', requireWriteAccess, ctrl.deleteOS);

module.exports = router;

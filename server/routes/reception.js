const express = require('express');
const { authenticate, requireWriteAccess } = require('../middleware/auth');
const ctrl = require('../controllers/receptionController');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

router.get('/reserves', ctrl.getReserves);
router.post('/reserves', requireWriteAccess, ctrl.createReserve);
router.put('/reserves/:reserveId', requireWriteAccess, ctrl.updateReserve);
router.put('/reserves/:reserveId/lever', requireWriteAccess, ctrl.leverReserve);
router.delete('/reserves/:reserveId', requireWriteAccess, ctrl.deleteReserve);
router.get('/dgd', ctrl.getDGDs);
router.post('/dgd', requireWriteAccess, ctrl.upsertDGD);
router.post('/solder', requireWriteAccess, ctrl.solderOperation);

module.exports = router;

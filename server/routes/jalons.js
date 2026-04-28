const express = require('express');
const { authenticate, requireWriteAccess, blockCompta } = require('../middleware/auth');
const ctrl = require('../controllers/jalonsController');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

// blockCompta appliqué par route (et non en global) pour ne pas intercepter
// les requêtes destinées aux autres routers montés sur la même base (/reserves, /dgd…)
router.get('/jalons', blockCompta, ctrl.getJalons);
router.post('/jalons', blockCompta, requireWriteAccess, ctrl.createJalon);
router.post('/jalons/seed', blockCompta, requireWriteAccess, ctrl.seedJalons);
router.put('/jalons/reorder', blockCompta, requireWriteAccess, ctrl.reorderJalons);
router.put('/jalons/:jalonId', blockCompta, requireWriteAccess, ctrl.updateJalon);
router.delete('/jalons/:jalonId', blockCompta, requireWriteAccess, ctrl.deleteJalon);

module.exports = router;

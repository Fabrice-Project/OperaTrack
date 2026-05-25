const express = require('express');
const multer  = require('multer');
const { authenticate, requireWriteAccess } = require('../middleware/auth');
const ctrl     = require('../controllers/importEclairageController');
const ctrlFeux = require('../controllers/importFeuxController');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 }, // 20 Mo max
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            || file.originalname.endsWith('.xlsx');
    if (!ok) return cb(new Error('Seuls les fichiers .xlsx sont acceptés'));
    cb(null, true);
  },
});

router.use(authenticate);

// Gabarit Excel — lecture seule, accessible à tous
router.get('/eclairage/template', ctrl.downloadTemplate);

// Import — écriture, bloqué pour directeur
router.post('/eclairage', requireWriteAccess, upload.single('file'), ctrl.importEclairage);

// Géocodage des armoires sans adresse (max 45 par appel)
router.post('/eclairage/geocode', requireWriteAccess, ctrl.geocodeArmoires);

// Gabarit feux tricolores
router.get('/feux/template', ctrlFeux.downloadTemplate);

// Import feux tricolores
router.post('/feux', requireWriteAccess, upload.single('file'), ctrlFeux.importFeux);

module.exports = router;

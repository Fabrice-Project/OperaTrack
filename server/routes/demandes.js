const express = require('express');
const multer  = require('multer');
const { authenticate, requireRole, requirePatrimoineReferentielWrite } = require('../middleware/auth');
const ctrl = require('../controllers/demandesController');

const router = express.Router();
router.use(authenticate);

const uploadMem = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 Mo max par photo
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Seules les images sont acceptées'));
  },
});

// Lecture : exploitant (ses demandes) + gestionnaire/admin (toutes)
router.get('/', ctrl.getDemandes);

// Création : tous les profils authentifiés (exploitant inclus)
router.post('/', ctrl.createDemande);

// Mise à jour statut/commentaire : admin, gestionnaire patrimonial, chargé op. + habilitation
router.put('/:id', requirePatrimoineReferentielWrite, ctrl.updateDemande);

// Historique : lecture accessible à tous
router.get('/:id/historique', ctrl.getHistorique);

// Message libre : tous les profils authentifiés
router.post('/:id/messages', ctrl.addMessage);

// Photos
router.get('/:id/photos', ctrl.getPhotos);

router.post('/:id/photos', (req, res, next) => {
  uploadMem.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, data: null, error: err.message });
    next();
  });
}, ctrl.uploadPhoto);

router.delete('/:id/photos/:photoId', requireRole('admin', 'gestionnaire_patrimonial'), ctrl.deletePhoto);

module.exports = router;

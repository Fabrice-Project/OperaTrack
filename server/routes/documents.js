const express = require('express');
const multer = require('multer');
const { authenticate, requireWriteAccess } = require('../middleware/auth');
const ctrl = require('../controllers/documentsController');

const router = express.Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.use(authenticate);

// Lecture — accessible à tous les profils (y compris administratif)
router.get('/documents/categories', ctrl.getCategories);
router.get('/documents/zip', ctrl.downloadZip);
router.get('/documents', ctrl.getDocuments);
router.get('/documents/:docId/download', ctrl.downloadDocument);
router.get('/documents/:docId/versions', ctrl.getVersions);

// Écriture — bloquée pour directeur (lecture seule), ouverte aux autres dont administratif
router.post('/documents', requireWriteAccess, upload.single('file'), ctrl.uploadDocument);
router.delete('/documents/:docId', requireWriteAccess, ctrl.deleteDocument);

module.exports = router;

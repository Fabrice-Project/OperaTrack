const express = require('express');
const multer = require('multer');
const { authenticate, requireWriteAccess, blockCompta } = require('../middleware/auth');
const ctrl = require('../controllers/documentsController');

const router = express.Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.use(authenticate);

// blockCompta appliqué par route (et non en global) pour ne pas intercepter
// les requêtes destinées aux autres routers montés sur la même base (/reserves, /dgd…)
router.get('/documents/categories', blockCompta, ctrl.getCategories);
router.get('/documents/zip', blockCompta, ctrl.downloadZip);
router.get('/documents', blockCompta, ctrl.getDocuments);
router.post('/documents', blockCompta, requireWriteAccess, upload.single('file'), ctrl.uploadDocument);
router.get('/documents/:docId/download', blockCompta, ctrl.downloadDocument);
router.get('/documents/:docId/versions', blockCompta, ctrl.getVersions);
router.delete('/documents/:docId', blockCompta, requireWriteAccess, ctrl.deleteDocument);

module.exports = router;

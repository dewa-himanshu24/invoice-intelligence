const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const documentController = require('../controllers/documentController');

router.post('/documents', upload.array('invoices', 20), documentController.uploadDocuments);
router.get('/documents', documentController.getDocuments);
router.get('/documents/:id', documentController.getDocument);
router.patch('/documents/:id', documentController.updateDocumentCorrection);
router.post('/reprocess/:id', documentController.reprocessDocument);
router.get('/metrics', documentController.getMetrics);

module.exports = router;
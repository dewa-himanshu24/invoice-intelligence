const { v4: uuidv4 } = require('uuid');
const storageService = require('../services/storageService');
const invoiceQueue = require('../config/queue');
const logger = require('../config/logger');

async function uploadDocuments(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const promptVersion = req.body.promptVersion || 'v1';

    const uploadPromises = req.files.map(async (file) => {
      const documentId = uuidv4();
      
      // 1. Upload to Supabase Storage
      const storagePath = await storageService.uploadFile(
        file.buffer, 
        file.originalname, 
        file.mimetype
      );

      // 2. Insert record into Supabase 'documents' table
      await storageService.insertDocument({
        id: documentId,
        filename: file.originalname,
        filePath: storagePath
      });

      // 3. Add to Bull queue for background processing
      await invoiceQueue.add({
        documentId,
        filePath: storagePath,
        promptVersion
      });

      return { id: documentId, filename: file.originalname, status: 'PENDING' };
    });

    const documents = await Promise.all(uploadPromises);

    res.status(202).json({
      message: 'Upload successful, processing started',
      documents
    });
  } catch (error) {
    logger.error(`Upload failed: ${error.message}`);
    next(error);
  }
}

async function getDocuments(req, res, next) {
  try {
    const { status } = req.query;
    const documents = await storageService.listDocuments(status);
    res.json(documents);
  } catch (error) {
    next(error);
  }
}

async function getDocument(req, res, next) {
  try {
    const { id } = req.params;
    const document = await storageService.getDocument(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(document);
  } catch (error) {
    next(error);
  }
}

async function updateDocumentCorrection(req, res, next) {
  try {
    const { id } = req.params;
    const { correctedData } = req.body;
    await storageService.saveCorrection(id, correctedData);
    res.json({ message: 'Correction saved successfully' });
  } catch (error) {
    next(error);
  }
}

async function reprocessDocument(req, res, next) {
  try {
    const { id } = req.params;
    const { promptVersion = 'v1' } = req.body;
    
    const doc = await storageService.getDocument(id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    await storageService.updateDocumentStatus(id, 'PENDING');
    await invoiceQueue.add({
      documentId: id,
      filePath: doc.file_path,
      promptVersion
    });

    res.json({ message: 'Reprocessing started' });
  } catch (error) {
    next(error);
  }
}

async function getMetrics(req, res, next) {
  try {
    const metrics = await storageService.getMetrics();
    res.json(metrics);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  uploadDocuments,
  getDocuments,
  getDocument,
  updateDocumentCorrection,
  reprocessDocument,
  getMetrics
};
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const fs = require('fs');
const storageService = require('../services/storageService');
const invoiceQueue = require('../config/queue');

async function uploadDocuments(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const documents = [];
    const promptVersion = process.env.PROMPT_VERSION || 'v2';

    for (const file of req.files) {
      const id = uuidv4();

      await storageService.insertDocument({
        id,
        filename: file.originalname,
        filePath: file.path
      });

      await invoiceQueue.add({
        documentId: id,
        filePath: file.path,
        promptVersion
      });

      documents.push({ id, filename: file.originalname, status: 'PENDING' });
    }

    res.status(202).json({
      message: 'Upload received',
      documents
    });
  } catch (error) {
    next(error);
  }
}

async function getDocuments(req, res, next) {
  try {
    const statusFilter = req.query.status;
    const documents = await storageService.listDocuments(statusFilter);
    res.json(documents);
  } catch (error) {
    next(error);
  }
}

async function getDocument(req, res, next) {
  try {
    const document = await storageService.getDocument(req.params.id);
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
    const document = await storageService.getDocument(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await storageService.saveCorrection(req.params.id, req.body);
    
    res.json({
      success: true,
      corrected_data: req.body
    });
  } catch (error) {
    next(error);
  }
}

async function reprocessDocument(req, res, next) {
  try {
    const id = req.params.id;
    const document = await storageService.getDocument(id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await storageService.updateDocumentStatus(id, 'PENDING');
    
    const promptVersion = process.env.PROMPT_VERSION || 'v2';
    
    await invoiceQueue.add({
      documentId: id,
      filePath: document.file_path,
      promptVersion
    });

    res.status(202).json({
      message: 'Reprocessing queued',
      id,
      status: 'PENDING'
    });
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
const fs = require('fs');
const invoiceQueue = require('../config/queue');
const extractionService = require('./extractionService');
const validationService = require('./validationService');
const storageService = require('./storageService');
const logger = require('../config/logger');

invoiceQueue.process(async (job) => {
  const { documentId, filePath: storagePath, promptVersion } = job.data;
  const startTime = Date.now();
  let tempLocalPath = null;

  try {
    // 1. Mark PROCESSING
    await storageService.updateDocumentStatus(documentId, 'PROCESSING');

    // 2. Download from Storage to local temp file
    logger.info(`Downloading ${storagePath} for processing...`);
    tempLocalPath = await storageService.downloadFile(storagePath);

    // 3. Extract
    const { extractedData } = await extractionService.extract(
      tempLocalPath, promptVersion
    );

    // 4. Validate
    const validationResult = validationService.validate(extractedData);

    // 5. Save extraction row
    await storageService.upsertExtraction(documentId, extractedData, validationResult);

    // 6. Mark COMPLETED
    const processingMs = Date.now() - startTime;
    await storageService.updateDocumentCompleted(documentId, processingMs, promptVersion);

    logger.info(`Document ${documentId} completed in ${processingMs}ms`);
  } catch (err) {
    const processingMs = Date.now() - startTime;
    await storageService.updateDocumentFailed(documentId, err.message, processingMs);
    logger.error(`Document ${documentId} failed: ${err.message}`);
    throw err;
  } finally {
    // 7. Cleanup temp file
    if (tempLocalPath && fs.existsSync(tempLocalPath)) {
      try {
        fs.unlinkSync(tempLocalPath);
        logger.info(`Cleaned up temp file: ${tempLocalPath}`);
      } catch (cleanupErr) {
        logger.warn(`Failed to cleanup temp file ${tempLocalPath}: ${cleanupErr.message}`);
      }
    }
  }
});

invoiceQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed after all attempts: ${err.message}`);
});

module.exports = invoiceQueue;
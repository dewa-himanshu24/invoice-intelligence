const invoiceQueue = require('../config/queue');
const extractionService = require('./extractionService');
const validationService = require('./validationService');
const storageService = require('./storageService');
const logger = require('../config/logger');

invoiceQueue.process(async (job) => {
  const { documentId, filePath, promptVersion } = job.data;
  const startTime = Date.now();

  try {
    // 1. Mark PROCESSING
    storageService.updateDocumentStatus(documentId, 'PROCESSING');

    // 2. Extract
    const { extractedData } = await extractionService.extract(
      filePath, promptVersion
    );

    // 3. Validate
    const validationResult = validationService.validate(extractedData);

    // 4. Save extraction row (upsert — reprocess may overwrite)
    storageService.upsertExtraction(documentId, extractedData, validationResult);

    // 5. Mark COMPLETED
    const processingMs = Date.now() - startTime;
    storageService.updateDocumentCompleted(documentId, processingMs, promptVersion);

    logger.info(`Document ${documentId} completed in ${processingMs}ms`);
  } catch (err) {
    const processingMs = Date.now() - startTime;
    storageService.updateDocumentFailed(documentId, err.message, processingMs);
    logger.error(`Document ${documentId} failed: ${err.message}`);
    throw err; // rethrow so Bull marks job as failed and triggers retry
  }
});

invoiceQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed after all attempts: ${err.message}`);
});

module.exports = invoiceQueue;
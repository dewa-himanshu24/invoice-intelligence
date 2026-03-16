const db = require('../config/database');

function insertDocument({ id, filename, filePath }) {
  const stmt = db.prepare(`
    INSERT INTO documents (id, filename, file_path, status)
    VALUES (?, ?, ?, 'PENDING')
  `);
  stmt.run(id, filename, filePath);
}

function updateDocumentStatus(id, status) {
  const stmt = db.prepare(`
    UPDATE documents 
    SET status = ?, updated_at = datetime('now') 
    WHERE id = ?
  `);
  stmt.run(status, id);
}

function updateDocumentCompleted(id, processingMs, promptVersion) {
  const stmt = db.prepare(`
    UPDATE documents 
    SET status = 'COMPLETED', error_message = NULL, processing_ms = ?, prompt_version = ?, updated_at = datetime('now') 
    WHERE id = ?
  `);
  stmt.run(processingMs, promptVersion, id);
}

function updateDocumentFailed(id, errorMessage, processingMs) {
  const stmt = db.prepare(`
    UPDATE documents 
    SET status = 'FAILED', error_message = ?, processing_ms = ?, updated_at = datetime('now') 
    WHERE id = ?
  `);
  stmt.run(errorMessage, processingMs, id);
}

function upsertExtraction(documentId, extractedData, validationResult) {
  const { normalizedData, missingFields, validationErrors, confidenceScore, isValid } = validationResult;
  
  const stmt = db.prepare(`
    INSERT INTO extractions (
      id, document_id, vendor_name, invoice_number, invoice_date, currency, 
      total_amount, tax_amount, line_items, raw_json, confidence_score, 
      validation_errors, missing_fields, is_valid
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(document_id) DO UPDATE SET
      vendor_name = excluded.vendor_name,
      invoice_number = excluded.invoice_number,
      invoice_date = excluded.invoice_date,
      currency = excluded.currency,
      total_amount = excluded.total_amount,
      tax_amount = excluded.tax_amount,
      line_items = excluded.line_items,
      raw_json = excluded.raw_json,
      confidence_score = excluded.confidence_score,
      validation_errors = excluded.validation_errors,
      missing_fields = excluded.missing_fields,
      is_valid = excluded.is_valid
  `);

  const uuid = require('uuid').v4;
  
  stmt.run(
    uuid(),
    documentId,
    normalizedData.vendor_name,
    normalizedData.invoice_number,
    normalizedData.invoice_date,
    normalizedData.currency,
    normalizedData.total_amount,
    normalizedData.tax_amount,
    JSON.stringify(normalizedData.line_items || []),
    JSON.stringify(normalizedData),
    confidenceScore,
    JSON.stringify(validationErrors || []),
    JSON.stringify(missingFields || []),
    isValid ? 1 : 0
  );
}

function getDocument(id) {
  const docStmt = db.prepare(`SELECT * FROM documents WHERE id = ?`);
  const doc = docStmt.get(id);
  if (!doc) return null;

  const extStmt = db.prepare(`SELECT * FROM extractions WHERE document_id = ?`);
  const extraction = extStmt.get(id);

  if (extraction) {
    if (extraction.line_items) extraction.line_items = JSON.parse(extraction.line_items);
    if (extraction.raw_json) extraction.raw_json = JSON.parse(extraction.raw_json);
    if (extraction.validation_errors) extraction.validation_errors = JSON.parse(extraction.validation_errors);
    if (extraction.missing_fields) extraction.missing_fields = JSON.parse(extraction.missing_fields);
    if (extraction.corrected_data) extraction.corrected_data = JSON.parse(extraction.corrected_data);
    extraction.is_valid = Boolean(extraction.is_valid);
  }

  return { ...doc, extraction };
}

function listDocuments(statusFilter) {
  let query = `
    SELECT d.id, d.filename, d.status, d.prompt_version, d.processing_ms, d.created_at,
           e.confidence_score, e.is_valid, e.missing_fields
    FROM documents d
    LEFT JOIN extractions e ON d.id = e.document_id
  `;
  const params = [];

  if (statusFilter) {
    query += ` WHERE d.status = ?`;
    params.push(statusFilter);
  }

  query += ` ORDER BY d.created_at DESC`;

  const rows = db.prepare(query).all(...params);
  
  return rows.map(row => {
    if (row.missing_fields) {
      row.missing_fields = JSON.parse(row.missing_fields);
    }
    if (row.is_valid !== null) {
      row.is_valid = Boolean(row.is_valid);
    }
    return row;
  });
}

function saveCorrection(id, correctedData) {
  const stmt = db.prepare(`
    UPDATE extractions 
    SET corrected_data = ? 
    WHERE document_id = ?
  `);
  stmt.run(JSON.stringify(correctedData), id);
}

function getMetrics() {
  const total = db.prepare(`SELECT COUNT(*) as count FROM documents`).get().count;
  const completed = db.prepare(`SELECT COUNT(*) as count FROM documents WHERE status = 'COMPLETED'`).get().count;
  const failed = db.prepare(`SELECT COUNT(*) as count FROM documents WHERE status = 'FAILED'`).get().count;
  const pending = db.prepare(`SELECT COUNT(*) as count FROM documents WHERE status IN ('PENDING', 'PROCESSING')`).get().count;
  
  const avgProcessingMs = db.prepare(`SELECT AVG(processing_ms) as avg FROM documents WHERE status = 'COMPLETED'`).get().avg || 0;
  
  const successRate = total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0;

  const fieldStats = db.prepare(`
    SELECT 
      SUM(CASE WHEN vendor_name IS NOT NULL THEN 1 ELSE 0 END) as vendor_name,
      SUM(CASE WHEN invoice_number IS NOT NULL THEN 1 ELSE 0 END) as invoice_number,
      SUM(CASE WHEN invoice_date IS NOT NULL THEN 1 ELSE 0 END) as invoice_date,
      SUM(CASE WHEN currency IS NOT NULL THEN 1 ELSE 0 END) as currency,
      SUM(CASE WHEN total_amount IS NOT NULL THEN 1 ELSE 0 END) as total_amount,
      SUM(CASE WHEN tax_amount IS NOT NULL THEN 1 ELSE 0 END) as tax_amount
    FROM extractions e
    JOIN documents d ON e.document_id = d.id
    WHERE d.status = 'COMPLETED'
  `).get() || {};

  const field_extraction_rates = {};
  for (const field of ['vendor_name', 'invoice_number', 'invoice_date', 'currency', 'total_amount', 'tax_amount']) {
    field_extraction_rates[field] = completed > 0 ? Number(((fieldStats[field] || 0) / completed * 100).toFixed(1)) : 0;
  }

  const recent_processing_times = db.prepare(`
    SELECT id, filename, processing_ms, created_at
    FROM documents
    WHERE status = 'COMPLETED'
    ORDER BY created_at DESC
    LIMIT 20
  `).all();

  const allExtractions = db.prepare(`SELECT validation_errors FROM extractions WHERE validation_errors IS NOT NULL`).all();
  const errorCounts = {};
  
  for (const row of allExtractions) {
    try {
      const errors = JSON.parse(row.validation_errors);
      for (const err of errors) {
        errorCounts[err] = (errorCounts[err] || 0) + 1;
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  const common_validation_errors = Object.entries(errorCounts)
    .map(([error, count]) => ({ error, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total,
    completed,
    failed,
    pending,
    avg_processing_ms: Math.round(avgProcessingMs),
    success_rate: successRate,
    field_extraction_rates,
    recent_processing_times,
    common_validation_errors
  };
}

module.exports = {
  insertDocument,
  updateDocumentStatus,
  updateDocumentCompleted,
  updateDocumentFailed,
  upsertExtraction,
  getDocument,
  listDocuments,
  saveCorrection,
  getMetrics
};
const supabase = require('../config/supabase');

async function insertDocument({ id, filename, filePath }) {
  const { error } = await supabase
    .from('documents')
    .insert([{ 
      id, 
      filename, 
      file_path: filePath, 
      status: 'PENDING' 
    }]);

  if (error) {
      console.log('~ list error', error);
    throw error
  };
}

async function updateDocumentStatus(id, status) {
  const { error } = await supabase
    .from('documents')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
    
  if (error) throw error;
}

async function updateDocumentCompleted(id, processingMs, promptVersion) {
  const { error } = await supabase
    .from('documents')
    .update({ 
      status: 'COMPLETED', 
      error_message: null, 
      processing_ms: processingMs, 
      prompt_version: promptVersion, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', id);
    
  if (error) throw error;
}

async function updateDocumentFailed(id, errorMessage, processingMs) {
  const { error } = await supabase
    .from('documents')
    .update({ 
      status: 'FAILED', 
      error_message: errorMessage, 
      processing_ms: processingMs, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', id);
    
  if (error) throw error;
}

async function upsertExtraction(documentId, extractedData, validationResult) {
  const { normalizedData, missingFields, validationErrors, confidenceScore, isValid } = validationResult;
  
  const { data: existing } = await supabase
    .from('extractions')
    .select('id')
    .eq('document_id', documentId)
    .single();

  const extractionData = {
    document_id: documentId,
    vendor_name: normalizedData.vendor_name,
    invoice_number: normalizedData.invoice_number,
    invoice_date: normalizedData.invoice_date,
    currency: normalizedData.currency,
    total_amount: normalizedData.total_amount,
    tax_amount: normalizedData.tax_amount,
    line_items: normalizedData.line_items || [],
    raw_json: normalizedData,
    confidence_score: confidenceScore,
    validation_errors: validationErrors || [],
    missing_fields: missingFields || [],
    is_valid: isValid
  };

  if (existing) {
    const { error } = await supabase
      .from('extractions')
      .update(extractionData)
      .eq('document_id', documentId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('extractions')
      .insert([{ id: require('uuid').v4(), ...extractionData }]);
    if (error) throw error;
  }
}

async function getDocument(id) {
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();

  if (docError || !doc) return null;

  const { data: extraction } = await supabase
    .from('extractions')
    .select('*')
    .eq('document_id', id)
    .single();

  return { ...doc, extraction };
}

async function listDocuments(statusFilter) {
  let query = supabase
    .from('documents')
    .select(`
      id, filename, status, prompt_version, processing_ms, created_at,
      extractions ( confidence_score, is_valid, missing_fields )
    `)
    .order('created_at', { ascending: false });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  console.log('~ list error', error);
  if (error) throw error;
  
  return data.map(row => ({
    ...row,
    confidence_score: row.extractions?.confidence_score,
    is_valid: row.extractions?.is_valid,
    missing_fields: row.extractions?.missing_fields
  }));
}

async function saveCorrection(id, correctedData) {
  const { error } = await supabase
    .from('extractions')
    .update({ corrected_data: correctedData })
    .eq('document_id', id);
  if (error) throw error;
}

async function getMetrics() {
  const { data: docs, error: docError } = await supabase
    .from('documents')
    .select('status, processing_ms, created_at, filename, id');
  
  if (docError) throw docError;

  const total = docs.length;
  const completedDocs = docs.filter(d => d.status === 'COMPLETED');
  const completed = completedDocs.length;
  const failed = docs.filter(d => d.status === 'FAILED').length;
  const pending = docs.filter(d => ['PENDING', 'PROCESSING'].includes(d.status)).length;
  
  const avgProcessingMs = completed > 0 
    ? completedDocs.reduce((acc, d) => acc + (d.processing_ms || 0), 0) / completed 
    : 0;
  
  const successRate = total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0;

  const { data: extractions, error: extError } = await supabase
    .from('extractions')
    .select('vendor_name, invoice_number, invoice_date, currency, total_amount, tax_amount, validation_errors');

  if (extError) throw extError;

  const field_extraction_rates = {};
  const fields = ['vendor_name', 'invoice_number', 'invoice_date', 'currency', 'total_amount', 'tax_amount'];
  
  for (const field of fields) {
    const count = extractions.filter(e => e[field] !== null).length;
    field_extraction_rates[field] = completed > 0 ? Number((count / completed * 100).toFixed(1)) : 0;
  }

  const recent_processing_times = completedDocs
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 20)
    .map(d => ({ id: d.id, filename: d.filename, processing_ms: d.processing_ms, created_at: d.created_at }));

  const errorCounts = {};
  extractions.forEach(e => {
    if (e.validation_errors && Array.isArray(e.validation_errors)) {
      e.validation_errors.forEach(err => {
        errorCounts[err] = (errorCounts[err] || 0) + 1;
      });
    }
  });

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
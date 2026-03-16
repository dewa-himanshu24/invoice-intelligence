import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDocument, useReprocess, useUpdateCorrection } from '../hooks/useDocuments';
import { useForm } from 'react-hook-form';
import StatusBadge from '../components/StatusBadge';
import ConfidenceBar from '../components/ConfidenceBar';
import LineItemsTable from '../components/LineItemsTable';
import { Loader2, RefreshCw, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const { data: doc, isLoading } = useDocument(id);
  const reprocessMutation = useReprocess();
  const updateMutation = useUpdateCorrection();
  const [toast, setToast] = useState(false);

  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    if (doc?.extraction) {
      const ext = doc.extraction;
      const dataToForm = ext.corrected_data || {
        vendor_name: ext.vendor_name || '',
        invoice_number: ext.invoice_number || '',
        invoice_date: ext.invoice_date || '',
        currency: ext.currency || '',
        total_amount: ext.total_amount || '',
        tax_amount: ext.tax_amount || ''
      };
      reset(dataToForm);
    }
  }, [doc, reset]);

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" /></div>;
  if (!doc) return <div className="p-8 text-center text-red-500">Document not found</div>;

  const isProcessing = ['PENDING', 'PROCESSING'].includes(doc.status);

  const onSubmit = async (data) => {
    // Convert numeric fields
    if (data.total_amount) data.total_amount = Number(data.total_amount);
    if (data.tax_amount) data.tax_amount = Number(data.tax_amount);

    await updateMutation.mutateAsync({ id, data });
    setToast(true);
    setTimeout(() => setToast(false), 3000);
  };

  const FieldRow = ({ label, value }) => (
    <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{value || '-'}</dd>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 truncate" title={doc.filename}>{doc.filename}</h1>
        <div className="flex items-center space-x-4">
          <StatusBadge status={doc.status} />
          {['COMPLETED', 'FAILED'].includes(doc.status) && (
            <button
              onClick={() => reprocessMutation.mutate(doc.id)}
              disabled={reprocessMutation.isPending}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Reprocess
            </button>
          )}
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">Document Metadata</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Details about the processing job.</p>
          </div>
          {doc.extraction?.confidence_score != null && (
            <div className="w-48 text-right">
              <span className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Confidence Score</span>
              <ConfidenceBar score={doc.extraction.confidence_score} />
            </div>
          )}
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-gray-200">
            <FieldRow label="Prompt Version" value={doc.prompt_version} />
            <FieldRow label="Processing Time" value={doc.processing_ms ? `${doc.processing_ms} ms` : null} />
            <FieldRow label="Uploaded" value={new Date(doc.created_at).toLocaleString()} />
            {doc.error_message && (
              <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-red-50">
                <dt className="text-sm font-medium text-red-800">Error</dt>
                <dd className="mt-1 text-sm text-red-700 sm:mt-0 sm:col-span-2">{doc.error_message}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {isProcessing && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-8">
          <div className="flex items-center">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin mr-3" />
            <p className="text-blue-700">Document is currently processing. This page will update automatically...</p>
          </div>
        </div>
      )}

      {doc.extraction && (
        <>
          {doc.extraction.validation_errors?.length > 0 && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-8">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Validation Errors</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <ul className="list-disc pl-5 space-y-1">
                      {doc.extraction.validation_errors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {doc.extraction.missing_fields?.length > 0 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Missing Required Fields</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>{doc.extraction.missing_fields.join(', ')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Extracted Data</h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">Read-only view of the raw extraction.</p>
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
                  <dl className="sm:divide-y sm:divide-gray-200">
                    <FieldRow label="Vendor Name" value={doc.extraction.vendor_name} />
                    <FieldRow label="Invoice Number" value={doc.extraction.invoice_number} />
                    <FieldRow label="Invoice Date" value={doc.extraction.invoice_date} />
                    <FieldRow label="Currency" value={doc.extraction.currency} />
                    <FieldRow label="Total Amount" value={doc.extraction.total_amount} />
                    <FieldRow label="Tax Amount" value={doc.extraction.tax_amount} />
                  </dl>
                </div>
              </div>

              <div className="mt-8">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Line Items</h3>
                <LineItemsTable items={doc.extraction.line_items} />
              </div>
            </div>

            <div>
              <div className="bg-white shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Manual Corrections</h3>
                  <p className="mt-1 text-sm text-gray-500">Override the extracted values here.</p>
                </div>
                <div className="px-4 py-5 sm:p-6">
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Vendor Name</label>
                      <input {...register("vendor_name")} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Invoice Number</label>
                      <input {...register("invoice_number")} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Invoice Date (YYYY-MM-DD)</label>
                      <input {...register("invoice_date")} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Currency</label>
                      <input {...register("currency")} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Total Amount</label>
                      <input type="number" step="0.01" {...register("total_amount")} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tax Amount</label>
                      <input type="number" step="0.01" {...register("tax_amount")} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    <div className="pt-4 flex items-center justify-between">
                      {toast ? (
                        <span className="text-sm text-green-600 flex items-center"><CheckCircle className="w-4 h-4 mr-1"/> Saved</span>
                      ) : <span></span>}
                      <button type="submit" disabled={updateMutation.isPending} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                        {updateMutation.isPending ? 'Saving...' : 'Save Corrections'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
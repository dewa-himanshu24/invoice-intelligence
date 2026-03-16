import React, { useState } from 'react';
import { useDocuments, useReprocess } from '../hooks/useDocuments';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import ConfidenceBar from '../components/ConfidenceBar';
import { Eye, RefreshCw, Filter } from 'lucide-react';

export default function InvoiceListPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data: documents, isLoading } = useDocuments(statusFilter);
  const reprocessMutation = useReprocess();

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
          <p className="mt-2 text-sm text-gray-700">A list of all uploaded and processed invoices.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Filename</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Confidence</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Processing Time</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Uploaded At</th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {isLoading ? (
                    <tr><td colSpan="6" className="text-center py-10 text-gray-500">Loading...</td></tr>
                  ) : documents?.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-10 text-gray-500">No invoices found.</td></tr>
                  ) : (
                    documents?.map((doc) => (
                      <tr key={doc.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 max-w-[200px] truncate" title={doc.filename}>
                          {doc.filename}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          <StatusBadge status={doc.status} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 w-48">
                          <ConfidenceBar score={doc.confidence_score} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {doc.processing_ms ? `${doc.processing_ms} ms` : '-'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {new Date(doc.created_at).toLocaleString()}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 space-x-3">
                          <Link to={`/invoices/${doc.id}`} className="text-indigo-600 hover:text-indigo-900 inline-flex items-center">
                            <Eye className="w-4 h-4 mr-1" /> View
                          </Link>
                          {['COMPLETED', 'FAILED'].includes(doc.status) && (
                            <button
                              onClick={() => reprocessMutation.mutate(doc.id)}
                              disabled={reprocessMutation.isPending}
                              className="text-gray-600 hover:text-gray-900 inline-flex items-center disabled:opacity-50"
                            >
                              <RefreshCw className={`w-4 h-4 mr-1 ${reprocessMutation.isPending && reprocessMutation.variables === doc.id ? 'animate-spin' : ''}`} /> Reprocess
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
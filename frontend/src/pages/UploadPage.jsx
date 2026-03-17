import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { useUpload } from '../hooks/useDocuments';
import { UploadCloud, File, X, Loader2 } from 'lucide-react';

export default function UploadPage() {
  const [files, setFiles] = useState([]);
  const navigate = useNavigate();
  const uploadMutation = useUpload();
  const [successMessage, setSuccessMessage] = useState('');

  const onDrop = useCallback(acceptedFiles => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 20
  });

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    try {
      const data = await uploadMutation.mutateAsync(files);
      setSuccessMessage(`${data.documents.length} invoices queued for processing`);
      setTimeout(() => {
        navigate('/invoices');
      }, 1500);
    } catch (error) {
      console.error('Upload failed', error);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="bg-white px-4 py-5 shadow sm:rounded-lg sm:p-6">
        <h2 className="text-lg leading-6 font-medium text-gray-900 mb-4">Upload Invoices</h2>
        
        {successMessage && (
          <div className="mb-4 rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <File className="h-5 w-5 text-green-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        <div 
          {...getRootProps()} 
          className={`mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${
            isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <div className="space-y-1 text-center">
            <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
            <div className="flex text-sm text-gray-600 justify-center">
              <input {...getInputProps()} />
              <p className="pl-1">Drag and drop PDF files here, or click to select files</p>
            </div>
            <p className="text-xs text-gray-500">Up to 20 PDFs, max 10MB each</p>
          </div>
        </div>

        {files.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Selected Files ({files.length})</h3>
            <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
              {files.map((file, idx) => (
                <li key={idx} className="pl-3 pr-4 py-3 flex items-center justify-between text-sm">
                  <div className="w-0 flex-1 flex items-center">
                    <File className="flex-shrink-0 h-5 w-5 text-gray-400" />
                    <span className="ml-2 flex-1 w-0 truncate">{file.name}</span>
                    <span className="ml-2 flex-shrink-0 text-gray-500">{formatFileSize(file.size)}</span>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      <X className="h-5 w-5 text-gray-400 hover:text-gray-500" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...
                  </>
                ) : (
                  'Upload'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
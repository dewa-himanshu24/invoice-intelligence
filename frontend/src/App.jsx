import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { UploadCloud, List, BarChart2, Loader2 } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';

// Code Splitting - Lazy Loading Pages
const UploadPage = lazy(() => import('./pages/UploadPage'));
const InvoiceListPage = lazy(() => import('./pages/InvoiceListPage'));
const InvoiceDetailPage = lazy(() => import('./pages/InvoiceDetailPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
    </div>
  );
}

function Navigation() {
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold text-indigo-600">DocIntel</span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link to="/upload" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                <UploadCloud className="w-4 h-4 mr-2" /> Upload
              </Link>
              <Link to="/invoices" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                <List className="w-4 h-4 mr-2" /> Invoices
              </Link>
              <Link to="/dashboard" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                <BarChart2 className="w-4 h-4 mr-2" /> Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Navigate to="/upload" replace />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/invoices" element={<InvoiceListPage />} />
                <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;

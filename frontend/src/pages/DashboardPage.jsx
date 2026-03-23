import React, { useMemo } from 'react';
import { useMetrics } from '../hooks/useDocuments';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { FileText, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export default function DashboardPage() {
  const { data: metrics, isLoading } = useMetrics();

  const extractionRates = useMemo(() => {
    if (!metrics) return [];
    return Object.entries(metrics.field_extraction_rates).map(([name, rate]) => ({
      name: name.replace('_', ' '),
      rate
    }));
  }, [metrics]);

  const recentTimes = useMemo(() => {
    if (!metrics) return [];
    return metrics.recent_processing_times.map(t => ({
      name: t.filename.length > 15 ? t.filename.substring(0, 15) + '...' : t.filename,
      ms: t.processing_ms
    })).reverse();
  }, [metrics]);

  const pieData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: 'Completed', value: metrics.completed, color: '#10B981' },
      { name: 'Failed', value: metrics.failed, color: '#EF4444' },
      { name: 'Pending', value: metrics.pending, color: '#F59E0B' },
    ].filter(d => d.value > 0);
  }, [metrics]);

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading metrics...</div>;
  if (!metrics) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0"><FileText className="h-6 w-6 text-gray-400" /></div>
              <div className="ml-5 w-0 flex-1">
                <dl><dt className="text-sm font-medium text-gray-500 truncate">Total Invoices</dt><dd className="text-lg font-medium text-gray-900">{metrics.total}</dd></dl>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0"><CheckCircle className="h-6 w-6 text-green-400" /></div>
              <div className="ml-5 w-0 flex-1">
                <dl><dt className="text-sm font-medium text-gray-500 truncate">Success Rate</dt><dd className="text-lg font-medium text-gray-900">{metrics.success_rate}%</dd></dl>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0"><Clock className="h-6 w-6 text-blue-400" /></div>
              <div className="ml-5 w-0 flex-1">
                <dl><dt className="text-sm font-medium text-gray-500 truncate">Avg Processing</dt><dd className="text-lg font-medium text-gray-900">{metrics.avg_processing_ms} ms</dd></dl>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0"><AlertTriangle className="h-6 w-6 text-red-400" /></div>
              <div className="ml-5 w-0 flex-1">
                <dl><dt className="text-sm font-medium text-gray-500 truncate">Failed</dt><dd className="text-lg font-medium text-gray-900">{metrics.failed}</dd></dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Field Extraction Success Rate */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Field Extraction Success Rate</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={extractionRates} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={100} fontSize={12} />
                <RechartsTooltip formatter={(value) => `${value}%`} />
                <Bar dataKey="rate" fill="#6366F1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Processing Time Line Chart */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Processing Time (Last 20)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={recentTimes} margin={{ top: 5, right: 20, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} fontSize={10} interval={0} />
                <YAxis />
                <RechartsTooltip formatter={(value) => `${value} ms`} />
                <Line type="monotone" dataKey="ms" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Status Distribution</h3>
          <div className="h-72 flex justify-center items-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500">No data</p>
            )}
          </div>
        </div>

        {/* Top Validation Errors */}
        <div className="bg-white shadow rounded-lg p-6 overflow-hidden flex flex-col">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Top Validation Errors</h3>
          <div className="flex-1 overflow-y-auto">
            {metrics.common_validation_errors.length === 0 ? (
              <p className="text-gray-500 text-sm mt-10 text-center">No validation errors recorded yet.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error Message</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {metrics.common_validation_errors.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.error}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 text-right">{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
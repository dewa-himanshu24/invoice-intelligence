import React from 'react';

export default function LineItemsTable({ items }) {
  if (!items || items.length === 0) {
    return <p className="text-gray-500 text-sm italic">No line items found.</p>;
  }

  return (
    <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 rounded-lg">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Description</th>
            <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Quantity</th>
            <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Unit Price</th>
            <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Line Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {items.map((item, idx) => (
            <tr key={idx}>
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 sm:pl-6">{item.description || '-'}</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">{item.quantity != null ? item.quantity : '-'}</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">{item.unit_price != null ? Number(item.unit_price).toFixed(2) : '-'}</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-medium text-right">{item.line_total != null ? Number(item.line_total).toFixed(2) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
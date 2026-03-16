import React from 'react';

export default function ConfidenceBar({ score }) {
  if (score == null) return null;
  
  const percentage = Math.round(score * 100);
  
  let colorClass = 'bg-green-500';
  if (score < 0.7) colorClass = 'bg-red-500';
  else if (score < 0.9) colorClass = 'bg-yellow-500';

  return (
    <div className="flex items-center space-x-2">
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div className={`h-2.5 rounded-full ${colorClass}`} style={{ width: `${percentage}%` }}></div>
      </div>
      <span className="text-sm font-medium text-gray-700">{percentage}%</span>
    </div>
  );
}
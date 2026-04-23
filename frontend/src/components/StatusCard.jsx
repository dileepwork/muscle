import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function StatusCard({ title, value, status, icon: Icon, description }) {
  
  const statusColors = {
    normal: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    warning: 'bg-amber-50 text-amber-600 border-amber-100',
    risk: 'bg-red-50 text-red-600 border-red-100',
    neutral: 'bg-blue-50 text-blue-600 border-blue-100'
  };

  const statusTextColors = {
    normal: 'text-emerald-500',
    warning: 'text-amber-500',
    risk: 'text-red-500',
    neutral: 'text-blue-500'
  };

  const activeColor = statusColors[status?.toLowerCase()] || statusColors.neutral;
  const activeTextColor = statusTextColors[status?.toLowerCase()] || statusTextColors.neutral;

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-500">{title}</h3>
          <div className={cn("p-2 rounded-lg border", activeColor)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-800">{value}</span>
          {status && (
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", activeColor)}>
              {status}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        )}
      </div>
    </div>
  );
}

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

  const activeColor = statusColors[status?.toLowerCase()] || statusColors.neutral;

  return (
    <div className="card transition-shadow hover:shadow-md">
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-500">{title}</h3>
          <div className={cn("rounded-lg border p-2", activeColor)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="break-words text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">{value}</span>
          {status && (
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", activeColor)}>
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

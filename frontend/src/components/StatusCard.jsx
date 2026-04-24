import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function StatusCard({ title, value, status, icon: Icon, description }) {
  const statusColors = {
    normal: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
    warning: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    risk: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
    neutral: 'border-neutral-800 bg-neutral-900 text-neutral-100',
  };

  const activeColor = statusColors[status?.toLowerCase()] || statusColors.neutral;

  return (
    <div className="card">
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">{title}</h3>
          <div className={cn('rounded-xl border p-2.5 ', activeColor)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="break-words text-2xl font-semibold leading-tight text-white sm:text-3xl">{value}</span>
          {status && (
            <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]', activeColor)}>
              {status}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-3 text-sm leading-6 text-neutral-500">{description}</p>
        )}
      </div>
    </div>
  );
}

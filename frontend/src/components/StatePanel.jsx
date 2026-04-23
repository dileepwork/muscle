import { AlertTriangle, Loader2 } from 'lucide-react';

export default function StatePanel({ type = 'empty', title, message, action }) {
  const isLoading = type === 'loading';
  const Icon = isLoading ? Loader2 : AlertTriangle;

  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
        <Icon className={isLoading ? 'h-5 w-5 animate-spin' : 'h-5 w-5'} />
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {message && <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

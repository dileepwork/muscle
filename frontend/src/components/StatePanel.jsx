import { AlertTriangle, Loader2 } from 'lucide-react';

export default function StatePanel({ type = 'empty', title, message, action }) {
  const isLoading = type === 'loading';
  const Icon = isLoading ? Loader2 : AlertTriangle;

  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-neutral-800 bg-neutral-900/70 px-6 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900  text-neutral-500 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
        <Icon className={isLoading ? 'h-5 w-5 animate-spin' : 'h-5 w-5'} />
      </div>
      <p className="text-sm font-semibold text-neutral-100">{title}</p>
      {message && <p className="mt-1 max-w-md text-sm leading-6 text-neutral-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

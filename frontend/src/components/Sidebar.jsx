import { NavLink } from 'react-router-dom';
import {
  History,
  LayoutDashboard,
  X,
  Zap,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Monitor', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Calibration', path: '/calibration', icon: Zap },
  { name: 'History', path: '/history', icon: History },
];

export default function Sidebar({ open, setOpen }) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex w-72 transform flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <Zap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold tracking-tight text-slate-900">MyoSense</p>
            <p className="text-xs font-medium text-slate-500">Simple EMG monitor</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close navigation"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 lg:hidden"
          onClick={() => setOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
              )
            }
            onClick={() => setOpen(false)}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Active Device</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">ESP32_01</p>
          <p className="text-xs text-slate-500">ESP32 EMG stream</p>
        </div>
      </div>
    </aside>
  );
}

import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Activity, 
  History, 
  BellRing, 
  ActivitySquare, 
  Settings,
  X,
  Zap
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Live Monitoring', path: '/live', icon: Activity },
  { name: 'History Logs', path: '/history', icon: History },
  { name: 'Alerts', path: '/alerts', icon: BellRing },
  { name: 'Rehabilitation', path: '/rehabilitation', icon: ActivitySquare },
  { name: 'Calibration', path: '/calibration', icon: Zap },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export default function Sidebar({ open, setOpen }) {
  return (
    <aside 
      className={cn(
        "fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex items-center justify-between h-16 px-6 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2 text-primary">
          <Zap className="h-6 w-6" fill="currentColor" />
          <span className="text-xl font-bold tracking-tight text-slate-800">MyoSense</span>
        </div>
        <button 
          className="lg:hidden text-slate-500 hover:text-slate-700 focus:outline-none"
          onClick={() => setOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="px-4 py-6">
          <p className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Main Menu
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-blue-50 text-blue-700" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
                onClick={() => setOpen(false)}
              >
                <item.icon className={cn("h-5 w-5", "flex-shrink-0")} />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>
        
        <div className="mt-auto p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3 border border-slate-100">
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
              Dr
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-800">Dr. Smith</span>
              <span className="text-xs text-slate-500">Physiotherapist</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

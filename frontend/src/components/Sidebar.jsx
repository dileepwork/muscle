import { NavLink } from 'react-router-dom';
import { History, LayoutDashboard, X, Zap } from 'lucide-react';

const nav = [
  { name: 'Monitor',     path: '/dashboard',   icon: LayoutDashboard },
  { name: 'Calibration', path: '/calibration', icon: Zap },
  { name: 'History',     path: '/history',     icon: History },
];

export default function Sidebar({ open, setOpen }) {
  return (
    <aside
      style={{ width: 220, borderRight: '1px solid #262626', background: '#0f0f0f' }}
      className={[
        'fixed inset-y-0 left-0 z-30 flex flex-col',
        'transition-transform duration-200 ease-out',
        'lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-4" style={{ borderBottom: '1px solid #262626' }}>
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-semibold text-white">MyoSense</span>
        <button
          onClick={() => setOpen(false)}
          className="ml-auto rounded p-1 text-neutral-500 hover:text-neutral-300 lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-3">
        {nav.map(({ name, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              [
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200',
              ].join(' ')
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {name}
          </NavLink>
        ))}
      </nav>

      {/* Device badge */}
      <div className="p-3" style={{ borderTop: '1px solid #262626' }}>
        <div className="rounded-md bg-neutral-900 px-3 py-2.5">
          <p className="text-xs text-neutral-500">Active device</p>
          <p className="mt-0.5 text-sm font-medium text-neutral-200">ESP32_01</p>
        </div>
      </div>
    </aside>
  );
}

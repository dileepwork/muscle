import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Wifi, WifiOff } from 'lucide-react';
import { API_URL, requestJson } from '../lib/api';

const titles = {
  '/dashboard':   'Monitor',
  '/calibration': 'Calibration',
  '/history':     'History',
};

export default function Header({ onMenuClick }) {
  const { pathname } = useLocation();
  const [online, setOnline] = useState(null);

  const title = useMemo(() => titles[pathname] ?? 'MyoSense', [pathname]);

  useEffect(() => {
    let ignore = false;
    const check = async () => {
      try {
        await requestJson('/api/health');
        if (!ignore) setOnline(true);
      } catch {
        if (!ignore) setOnline(false);
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => { ignore = true; clearInterval(id); };
  }, []);

  return (
    <header
      className="sticky top-0 z-10 flex h-14 items-center gap-3 px-5"
      style={{ borderBottom: '1px solid #262626', background: '#0f0f0f' }}
    >
      <button
        onClick={onMenuClick}
        className="rounded p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>

      <span className="text-sm font-semibold text-neutral-100">{title}</span>

      <div className="ml-auto flex items-center gap-3">
        {online !== null && (
          <span
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
              online
                ? 'border-green-900 bg-green-950 text-green-400'
                : 'border-red-900 bg-red-950 text-red-400'
            }`}
          >
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {online ? 'API connected' : 'API offline'}
          </span>
        )}
      </div>
    </header>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Wifi, WifiOff } from 'lucide-react';
import { API_URL, requestJson } from '../lib/api';

const pageTitles = {
  '/dashboard': 'Monitor',
  '/calibration': 'Calibration',
  '/history': 'History',
};

export default function Header({ onMenuClick }) {
  const location = useLocation();
  const [health, setHealth] = useState({ status: 'checking', updatedAt: null });

  const pageTitle = useMemo(() => pageTitles[location.pathname] || 'MyoSense', [location.pathname]);

  useEffect(() => {
    let ignore = false;

    const checkHealth = async () => {
      try {
        await requestJson('/api/health');
        if (!ignore) setHealth({ status: 'online', updatedAt: new Date() });
      } catch {
        if (!ignore) setHealth({ status: 'offline', updatedAt: new Date() });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, []);

  const isOnline = health.status === 'online';

  return (
    <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenuClick}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 sm:text-base">{pageTitle}</p>
          <p className="hidden truncate text-xs text-slate-500 sm:block">API: {API_URL}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className={`badge hidden sm:inline-flex ${
            isOnline
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
          title={health.updatedAt ? `Last checked ${health.updatedAt.toLocaleTimeString()}` : 'Checking backend'}
        >
          {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {isOnline ? 'Backend online' : 'Backend offline'}
        </div>
      </div>
    </header>
  );
}

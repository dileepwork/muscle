import React from 'react';
import { Menu, Search, Bell } from 'lucide-react';

export default function Header({ onMenuClick }) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 z-10 sticky top-0">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden text-slate-500 hover:text-slate-700 focus:outline-none"
        >
          <Menu className="h-5 w-5" />
        </button>
        
        <div className="hidden sm:flex relative max-w-md w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
            placeholder="Search patient, device id..."
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="relative">
          <button className="text-slate-400 hover:text-slate-600 transition-colors relative p-2 rounded-full hover:bg-slate-50">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
          </button>
        </div>
        
        <div className="hidden sm:flex items-center gap-2 border-l border-slate-200 pl-4">
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold text-slate-800">Hardware Team</span>
            <span className="text-xs text-green-500 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
              Backend Active
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

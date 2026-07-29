import React from 'react';
import { Search, Bell, ShieldCheck, Building2 } from 'lucide-react';
import { mockAdminUser } from '../services/mockData';

export default function Navbar() {
  return (
    <header className="h-16 bg-white border-b border-surface-border px-6 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      {/* Left: Fixed Society Name Header Badge */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
          <Building2 className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-navy leading-none">Lakeview Apartments</h2>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">50 Subscribed Units • Gated Community</p>
        </div>
      </div>

      {/* Center: Global Quick Search Input */}
      <div className="flex items-center gap-2 max-w-md w-full bg-slate-50 px-3.5 py-1.5 rounded-lg border border-slate-200 focus-within:border-navy focus-within:ring-1 focus-within:ring-navy transition-all">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search unit, vehicle plate, pass code, resident..."
          className="bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none w-full"
        />
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded">⌘K</kbd>
      </div>

      {/* Right: Security Badge, Overstay Alerts, Admin Profile */}
      <div className="flex items-center gap-4">
        {/* Gatekeeper Security Policy Indicator */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Visual Pass Policy</span>
        </div>

        {/* Overstay Notification Bell */}
        <button className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors" title="Overstay Alerts">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>
        </button>

        {/* Logged-in Admin Profile */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center font-bold text-xs shadow-sm">
            {mockAdminUser.avatar}
          </div>
          <div className="hidden lg:block leading-none">
            <p className="text-xs font-semibold text-navy">{mockAdminUser.name}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{mockAdminUser.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

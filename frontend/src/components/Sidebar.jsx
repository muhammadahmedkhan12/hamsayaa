import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Car,
  AlertCircle,
  Vote,
  Contact,
  Wrench,
  Settings as SettingsIcon,
  Building2
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Residents & Invoices', path: '/residents', icon: Users },
  { name: 'Gate Logs', path: '/vehicles', icon: Car },
  { name: 'Tickets', path: '/complaints', icon: AlertCircle },
  { name: 'Polls', path: '/polls', icon: Vote },
  { name: 'Employees', path: '/employees', icon: Contact },
  { name: 'Assets', path: '/assets', icon: Wrench },
  { name: 'Settings', path: '/settings', icon: SettingsIcon },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-navy text-slate-300 flex flex-col min-h-screen border-r border-slate-800 flex-shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
          ہ
        </div>
        <div>
          <h1 className="font-bold text-white tracking-wide text-lg flex items-center gap-1.5">
            Hamsayaa
            <span className="text-[10px] bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded font-mono">v1.4</span>
          </h1>
          <p className="text-xs text-slate-400">Society Admin Concierge</p>
        </div>
      </div>

      {/* Active Society Badge */}
      <div className="mx-4 my-4 p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center gap-2.5">
        <Building2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <div className="overflow-hidden">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Tenant</p>
          <p className="text-xs font-semibold text-white truncate">Lakeview Apartments</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white font-semibold shadow-sm border-l-4 border-emerald-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Admin User Footer */}
      <div className="p-4 border-t border-slate-800 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
          AA
        </div>
        <div className="overflow-hidden">
          <p className="text-xs font-medium text-white truncate">Absar Anwer</p>
          <p className="text-xs text-slate-400 truncate">admin@lakeview.com</p>
        </div>
      </div>
    </aside>
  );
}

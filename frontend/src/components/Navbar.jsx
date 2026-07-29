import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Search, 
  Bell, 
  ShieldCheck, 
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
import { mockAdminUser } from '../services/mockData';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Residents', path: '/residents', icon: Users },
  { name: 'Gate Logs', path: '/vehicles', icon: Car },
  { name: 'Tickets', path: '/complaints', icon: AlertCircle },
  { name: 'Polls', path: '/polls', icon: Vote },
  { name: 'Employees', path: '/employees', icon: Contact },
  { name: 'Assets', path: '/assets', icon: Wrench },
  { name: 'Settings', path: '/settings', icon: SettingsIcon },
];

export default function Navbar() {
  return (
    <header className="w-full bg-white border-b border-surface-border sticky top-0 z-50 shadow-sm flex-shrink-0">
      {/* Upper Row: Brand Logo, Active Society, Search, Profile */}
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Active Society */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
              ہ
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-navy tracking-wide text-base leading-none">
                Hamsayaa
              </h1>
              <p className="text-[10px] text-slate-400 mt-1">Society Admin Concierge</p>
            </div>
          </div>

          {/* Active Society Badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg">
            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold text-navy">Lakeview Apartments</span>
          </div>
        </div>

        {/* Center: Global Quick Search Input */}
        <div className="flex-1 max-w-md bg-slate-50 px-3.5 py-1.5 rounded-lg border border-slate-200 focus-within:border-navy focus-within:ring-1 focus-within:ring-navy transition-all">
          <input
            type="text"
            placeholder="Search unit, vehicle plate, pass code..."
            className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-full"
          />
        </div>

        {/* Right: Notification & Profile */}
        <div className="flex items-center gap-4">
          {/* Visual Pass Badge */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Visual Pass Policy</span>
          </div>

          {/* Notification Bell */}
          <button className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors" title="Overstay Alerts">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>
          </button>

          {/* Logged-in Admin Profile */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center font-bold text-xs shadow-sm">
              {mockAdminUser.avatar}
            </div>
            <div className="hidden lg:block leading-none">
              <p className="text-xs font-semibold text-navy">{mockAdminUser.name}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">{mockAdminUser.role}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lower Row: Horizontal Navigation Links */}
      <div className="bg-slate-50 border-t border-slate-100 w-full">
        <div className="max-w-7xl mx-auto px-6 overflow-x-auto flex items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-3 text-xs font-semibold transition-all border-b-2 whitespace-nowrap ${
                    isActive
                      ? 'border-emerald-500 text-navy font-bold bg-white/50'
                      : 'border-transparent text-slate-500 hover:text-navy hover:border-slate-300'
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </header>
  );
}

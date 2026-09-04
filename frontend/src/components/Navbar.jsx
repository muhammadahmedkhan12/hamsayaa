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
  Sparkles,
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
  { name: 'Amenities', path: '/amenities', icon: Sparkles },
  { name: 'Settings', path: '/settings', icon: SettingsIcon },
];

export default function Navbar() {
  return (
    <header className="w-full bg-white border-b border-surface-border sticky top-0 z-50 shadow-sm flex-shrink-0">
      {/* Upper Row: Brand Logo, Active Society, Search, Profile */}
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Active Society */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 select-none">
            {/* SVG Logo - Hamsayaa */}
            <svg width="158" height="32" viewBox="0 0 158 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 w-auto">
              <path d="M4 0C1.79086 0 0 1.79086 0 4V19C0 21.2091 1.79086 23 4 23H9.5L5.5 27L10.5 23H28C30.2091 23 32 21.2091 32 19V4C32 1.79086 30.2091 0 28 0H4Z" fill="#00569e" />
              <path d="M8 14.5L16 8L24 14.5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <text x="44" y="19" fill="#00569e" fontFamily="Inter, system-ui, sans-serif" fontSize="15" fontWeight="800" letterSpacing="0.12em">HAMSAYAA</text>
            </svg>
          </div>

          {/* Active Society Badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg">
            <Building2 className="w-3.5 h-3.5 text-brand-500" />
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
                      ? 'border-brand-500 text-navy font-bold bg-white/50'
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

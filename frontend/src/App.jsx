import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';

import Dashboard from './pages/Dashboard';
import Residents from './pages/Residents';
import Invoices from './pages/Invoices';
import Vehicles from './pages/Vehicles';
import Complaints from './pages/Complaints';
import Polls from './pages/Polls';
import Employees from './pages/Employees';
import Assets from './pages/Assets';
import Amenities from './pages/Amenities';
import Settings from './pages/Settings';

export default function App() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-slate text-slate-800 font-sans">
      {/* Top Header Navigation Bar (Includes brand, search, tabs, & profile) */}
      <Navbar />

      {/* Main Content Area (Takes full viewport width, centered inside 7xl max-width) */}
      <main className="flex-1 p-6 md:p-8">
        <div className="max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/residents" element={<Residents />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/complaints" element={<Complaints />} />
            <Route path="/tickets" element={<Complaints />} />
            <Route path="/polls" element={<Polls />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/amenities" element={<Amenities />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

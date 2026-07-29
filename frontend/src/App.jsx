import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
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
    <div className="flex min-h-screen bg-surface-slate text-slate-800 font-sans">
      {/* Fixed Deep Navy Navigation Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Action Navbar */}
        <Navbar />

        {/* Page Content */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
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
        </main>
      </div>
    </div>
  );
}

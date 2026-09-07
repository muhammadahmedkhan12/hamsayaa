import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';

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

function ProtectedRoute({ children }) {
  const { admin, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-slate">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }
  if (!admin) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <div className="flex flex-col min-h-screen bg-surface-slate text-slate-800 font-sans">
            <Navbar />
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
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

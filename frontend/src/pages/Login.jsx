import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginApi } from '../services/api';
import { Lock, Mail, Eye, EyeOff, LogIn, AlertCircle, Key, ShieldCheck } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    
    setLoading(true);
    const res = await loginApi(email, password);
    setLoading(false);
    
    if (res.status === 'error') {
      setError(res.message);
      return;
    }
    
    login(res.token, res.admin);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 select-none mb-2">
            <svg width="158" height="32" viewBox="0 0 158 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-auto">
              <path d="M4 0C1.79086 0 0 1.79086 0 4V19C0 21.2091 1.79086 23 4 23H9.5L5.5 27L10.5 23H28C30.2091 23 32 21.2091 32 19V4C32 1.79086 30.2091 0 28 0H4Z" fill="#00569e" />
              <path d="M8 14.5L16 8L24 14.5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <text x="44" y="19" fill="#00569e" fontFamily="Inter, system-ui, sans-serif" fontSize="15" fontWeight="800" letterSpacing="0.12em">HAMSAYAA</text>
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-500">Society Management Dashboard</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                placeholder="admin@hamsayaa.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 focus:outline-none disabled:opacity-70 transition-colors"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn className="w-4 h-4" /> Sign In
              </>
            )}
          </button>
        </form>

        {/* Super Admin Credentials Card */}
        <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-brand-600" /> Super Admin Credentials
            </span>
            <button
              type="button"
              onClick={() => {
                setEmail('admin@hamsayaa.com');
                setPassword('admin123');
                setError('');
              }}
              className="text-[10px] font-bold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Click to auto-fill credentials into form"
            >
              <Key className="w-3 h-3" /> Auto-Fill
            </button>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span className="text-[11px] font-medium text-slate-500">Email:</span>
              <span className="font-mono font-semibold text-slate-800 select-all bg-white px-1.5 py-0.5 rounded border border-slate-200">
                admin@hamsayaa.com
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-[11px] font-medium text-slate-500">Password:</span>
              <span className="font-mono font-semibold text-slate-800 select-all bg-white px-1.5 py-0.5 rounded border border-slate-200">
                admin123
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

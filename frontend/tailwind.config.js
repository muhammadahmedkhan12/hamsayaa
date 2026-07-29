/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          800: '#1e293b',
          900: '#0f172a',
          DEFAULT: '#0f172a',
        },
        surface: {
          slate: '#f8fafc',
          muted: '#f1f5f9',
          border: '#e2e8f0',
        },
        status: {
          paid: '#10b981',
          pending: '#f59e0b',
          unpaid: '#ef4444',
          overdue: '#b91c1c',
          open: '#3b82f6',
          verified: '#10b981',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'sm': '0.125rem',
        DEFAULT: '0.25rem',
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
      }
    },
  },
  plugins: [],
};

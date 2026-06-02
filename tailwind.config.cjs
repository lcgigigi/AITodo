/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{vue,ts,js}'],
  theme: {
    extend: {
      colors: {
        app: {
          primary: 'var(--app-primary)',
          bg: 'var(--app-bg)',
          panel: 'var(--app-panel-bg)',
          card: 'var(--app-card-bg)',
        },
      },
      borderRadius: {
        app: 'var(--radius)',
      },
      boxShadow: {
        app: 'var(--app-shadow-soft)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
      },
    },
  },
  daisyui: {
    themes: [
      {
        aiworkbench: {
          primary: '#4f7cff',
          secondary: '#735cff',
          accent: '#20b97a',
          neutral: '#182044',
          'base-100': '#ffffff',
          'base-200': '#f4f7fc',
          'base-300': '#e6ebf5',
          info: '#2f68ff',
          success: '#20b97a',
          warning: '#f6b73c',
          error: '#ef4444',
          '--rounded-box': '1.375rem',
          '--rounded-btn': '0.875rem',
          '--rounded-badge': '999px',
          '--animation-btn': '0.18s',
          '--animation-input': '0.18s',
          '--btn-focus-scale': '0.98',
          '--border-btn': '0',
          '--tab-border': '1px',
          '--tab-radius': '0.875rem',
        },
      },
      'light',
      'dark',
    ],
  },
  plugins: [require('daisyui')],
}

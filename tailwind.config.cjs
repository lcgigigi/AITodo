/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
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
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
      },
      borderRadius: {
        app: 'var(--radius)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
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

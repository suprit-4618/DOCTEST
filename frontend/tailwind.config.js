/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Outfit', 'system-ui', 'sans-serif'],
        heading: ['Outfit', '"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        slate: {
          50: 'var(--color-slate-50)',
          100: 'var(--color-slate-100)',
          200: 'var(--color-slate-200)',
          300: 'var(--color-slate-300)',
          400: 'var(--color-slate-400)',
          500: 'var(--color-slate-500)',
          600: 'var(--color-slate-600)',
          700: 'var(--color-slate-700)',
          750: 'var(--color-slate-750)',
          800: 'var(--color-slate-800)',
          850: 'var(--color-slate-850)',
          900: 'var(--color-slate-900)',
          950: 'var(--color-slate-950)',
        },
        indigo: {
          50: 'var(--color-indigo-50)',
          100: 'var(--color-indigo-100)',
          200: 'var(--color-indigo-200)',
          300: 'var(--color-indigo-300)',
          400: 'var(--color-indigo-400)',
          500: 'var(--color-indigo-500)',
          600: 'var(--color-indigo-600)',
          700: 'var(--color-indigo-700)',
          800: 'var(--color-indigo-800)',
          900: 'var(--color-indigo-900)',
          950: 'var(--color-indigo-950)',
        },
        violet: {
          400: 'var(--color-violet-400)',
          500: 'var(--color-violet-500)',
          600: 'var(--color-violet-600)',
        },
        cozy: {
          cream: '#FAF7F2',
          marshmallow: '#FFFFFF',
          biscuit: '#EDE4DC',
          mocha: '#7D6E66',
          espresso: '#3C2F2F',
          strawberry: '#FB7185',
          matcha: '#10B981',
          honey: '#F59E0B',
          taro: '#A78BFA',
          peach: '#FDBA74',
        }
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2.25rem',
      },
      boxShadow: {
        'cozy': '0 10px 28px -4px rgba(80, 50, 40, 0.08), 0 4px 12px -2px rgba(80, 50, 40, 0.04)',
        'cozy-hover': '0 16px 36px -4px rgba(80, 50, 40, 0.14), 0 8px 16px -2px rgba(80, 50, 40, 0.06)',
        'cozy-pill': '0 2px 8px 0 rgba(80, 50, 40, 0.06)',
      }
    },
  },
  plugins: [],
}

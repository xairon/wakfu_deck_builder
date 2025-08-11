/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        wakfu: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#b9e6fe',
          300: '#7cd4fd',
          400: '#36bffa',
          500: '#0ca6eb',
          600: '#0284c7',
          700: '#036ba1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
      },
      fontFamily: {
        sans: ['Inter var', 'sans-serif'],
        display: ['Lexend', 'sans-serif'],
      },
      animation: {
        float: 'float 3s ease-in-out infinite',
        glow: 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
      },
    },
  },
  plugins: [
    require('daisyui'),
    function ({ addComponents }) {
      addComponents({
        '.deck-comparison': {
          '@apply p-6 bg-base-200 rounded-xl w-full': {},
        },
        '.stats-card': {
          '@apply bg-base-100 p-4 rounded-lg shadow-md': {},
        },
        '.card-title': {
          '@apply text-lg font-bold mb-4 text-base-content': {},
        },
        '.stats': {
          '@apply grid grid-cols-2 gap-4': {},
        },
        '.stat': {
          '@apply flex flex-col items-start gap-1': {},
        },
        '.stat-title': {
          '@apply text-sm font-medium text-base-content/60': {},
        },
        '.stat-value': {
          '@apply text-xl font-semibold text-base-content': {},
        },
        '.comparison-card': {
          '@apply bg-base-100 p-4 rounded-lg shadow-md': {},
        },
        '.comparison-stat': {
          '@apply flex flex-col items-center justify-center text-center gap-2':
            {},
        },
        '.cost-distribution': {
          '@apply bg-base-100 p-4 rounded-lg shadow-md': {},
        },
        '.cost-bar': {
          '@apply flex flex-col relative w-full': {},
        },
        '.cost-bar > div:last-child': {
          '@apply overflow-hidden rounded-md relative': {},
        },
      })
    },
  ],
  daisyui: {
    themes: [
      {
        wakfu: {
          primary: '#0ca6eb',
          secondary: '#7c3aed',
          accent: '#f59e0b',
          neutral: '#374151',
          'base-100': '#f3f4f6',
          info: '#3b82f6',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
        },
        wakfuDark: {
          primary: '#0ca6eb',
          secondary: '#7c3aed',
          accent: '#f59e0b',
          neutral: '#1f2937',
          'base-100': '#111827',
          info: '#3b82f6',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
        },
      },
    ],
    darkTheme: 'wakfuDark',
  },
}

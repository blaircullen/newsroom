import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Navy palette — from the "N" and "News" in the logo
        ink: {
          50: '#f0f3f8',
          100: '#dce3f0',
          200: '#bcc9e1',
          300: '#91a7cc',
          400: '#6580b0',
          500: '#465f94',
          600: '#364b79',
          700: '#2c3d63',
          800: '#213050',
          900: '#192842',
          950: '#111c30',
        },
        // Crimson red palette — from the "R" and "Room" in the logo
        press: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#D42B2B',
          600: '#C02424',
          700: '#A01D1D',
          800: '#841919',
          900: '#6F1616',
          950: '#450A0A',
        },
        // Clean paper/background tones
        paper: {
          50: '#fdfcfb',
          100: '#f8f9fa',
          200: '#f1f3f5',
          300: '#e9ecef',
          400: '#dee2e6',
        },
      },
      fontFamily: {
        'display': ['"Playfair Display"', 'Georgia', 'serif'],
        'body': ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        'mono': ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        'display-xl': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-lg': ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.015em' }],
        'display-md': ['1.875rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 10px 25px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.04)',
        'elevated': '0 20px 50px rgba(0,0,0,0.08), 0 8px 20px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography'),],
};

export default config;

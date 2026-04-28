/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        heading: ['"DM Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      },
      colors: {
        primary: '#1A3A5C',
        secondary: '#2E75B6',
        accent: '#E8920A',
        danger: '#C0392B',
        success: '#1E7E45',
        'bg-page': '#F4F6F9',
        surface: '#FFFFFF',
        'text-main': '#1C2B39',
        'text-muted': '#6B7A8D',
        border: '#DDE3EA'
      }
    }
  },
  plugins: []
};

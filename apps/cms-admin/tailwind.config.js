/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0066cc', dark: '#004d99', light: '#3385d6' },
      },
    },
  },
  plugins: [],
};

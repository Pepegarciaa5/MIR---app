/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#BA7517',
        'accent-bg': '#fef3e2',
      },
    },
  },
  plugins: [],
}

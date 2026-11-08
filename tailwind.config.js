/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ps: {
          bg: '#1b1d21',
          panel: '#24272c',
          panel2: '#2b2f35',
          border: '#3a3f47',
          text: '#d7dae0',
          muted: '#8b919b',
          accent: '#3b9cff',
          accent2: '#f7b500',
        },
      },
      fontFamily: { ui: ['Segoe UI', 'Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef0f9',
          100: '#d5daf0',
          200: '#b0b8e3',
          300: '#8a96d6',
          400: '#6e7cc9',
          500: '#5C6BC0',
          600: '#4a56a3',
          700: '#3b4583',
          800: '#2c3363',
          900: '#1d2242',
        },
        secondary: {
          50: '#e6f5f3',
          100: '#c0e6e1',
          200: '#96d6cd',
          300: '#6cc6b9',
          400: '#4db9aa',
          500: '#26A69A',
          600: '#1f8a80',
          700: '#186d66',
          800: '#12514c',
          900: '#0c3532',
        },
        accent: {
          50: '#fff8eb',
          100: '#ffedcc',
          200: '#ffdea3',
          300: '#ffce7a',
          400: '#ffc35c',
          500: '#FFB74D',
          600: '#d99940',
          700: '#b37b33',
          800: '#8c5e26',
          900: '#66401a',
        },
        surface: '#FFFFFF',
        background: '#FAFAFA',
        text: {
          primary: '#37474F',
          secondary: '#78909C',
        }
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      borderRadius: {
        'organic': '0.625rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      }
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          100: "#F4F6F9",
          200: "#E9ECEF",
          300: "#8B5CF6",
          400: "#8B5CF6",
          500: "#0284C7",
          600: "#0284C7",
          700: "#0284C7",
          800: "#0284C7",
          900: "#0284C7",
          950: "#0284C7",
          DEFAULT: "#0284C7",
        },
        forest: "#0284C7",
        ink: "#0284C7",
        cream: "#F8F9FA",
        mint: "#F4F6F9",
        gold: "#8B5CF6",
      },
      fontFamily: {
        display: ["Georgia", "serif"],
        sans: ["Arial", "Helvetica", "sans-serif"],
      },
    },
  },
  plugins: [],
};

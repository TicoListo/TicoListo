/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        forest: "#0b6e4f",
        ink: "#17231e",
        cream: "#f7f6f1",
        mint: "#e4f1eb",
        gold: "#f2c86b",
      },
      fontFamily: {
        display: ["Georgia", "serif"],
        sans: ["Arial", "Helvetica", "sans-serif"],
      },
    },
  },
  plugins: [],
};

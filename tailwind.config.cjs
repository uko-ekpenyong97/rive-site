/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: require("./dist/tailwind.tokens.cjs"),
  },
  plugins: [],
};

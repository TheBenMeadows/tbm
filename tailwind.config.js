const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  // Scope scanning to the files actually served — avoids pulling class names
  // from node_modules/ and old template experiments into the built CSS.
  content: [
    "./index.html",
    "./404.html",
    "./email.js",
    "./mirrors/index.html",
    "./tech/index.html",
    "./experiments/index.html",
    "./projects/index.html",
    "./infra/index.html",
    "./essentialism/index.html",
    "./essentialism/play.js",
    "./search/index.html",
        "./profiles/index.html",
    // search.js builds the overlay at runtime; without this its classes get purged.
    "./search.js",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Public Sans"', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};

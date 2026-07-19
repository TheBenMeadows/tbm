const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  // Scope scanning to the files actually served — avoids pulling class names
  // from node_modules/ and old template experiments into the built CSS.
  content: ["./index.html", "./404.html", "./email.js"],
  theme: {
    extend: {
      colors: {
        // Brand dark (soft black) — canonical across Ben's pages.
        "brand-dark": "#111418",
      },
      fontFamily: {
        sans: ['"Public Sans"', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};

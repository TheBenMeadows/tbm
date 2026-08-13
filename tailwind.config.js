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
  // Tailwind's extractor treats any bare word in a scanned file as a possible
  // class name, so ordinary English in 404.html's inline <style> and a .blur()
  // call in search.js were generating four utilities that no class attribute in
  // the site ever uses. Blocking them by name is 640 bytes off the stylesheet.
  // These are exact names: .transition-colors and .outline-none are different
  // strings and still build.
  blocklist: ["transition", "outline", "blur", "text-justify"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Public Sans"', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};

// Loaded synchronously in <head> so the stored theme applies before first
// paint (no flash). External file because the site CSP is script-src 'self'.
// Values: "auto" (default, follows the system) | "day" | "night".
(function () {
    var t = null;
    try { t = localStorage.getItem("prayers-theme"); } catch (e) {}
    if (t === "day" || t === "night") {
        document.documentElement.dataset.theme = t;
    }
})();

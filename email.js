(function () {
    var el = document.getElementById('email-link');
    if (!el) return;
    // Assembled at runtime so the address isn't a plain-text mailto in the HTML.
    // iCloud Hide My Email alias — forwards to Ben's inbox, revocable if it leaks.
    var u = ['basques', '.', 'crepes', '_7z'];
    var d = ['icloud', 'com'];
    el.href = 'mai' + 'lto:' + u.join('') + '@' + d.join('.');
})();

(function () {
    // Every element carrying the class gets the address — the footer contact
    // line puts one on every page, and /profiles/ has a second in its list.
    // (The old single #email-link id is covered too, for anything cached.)
    var els = document.querySelectorAll('.js-email, #email-link');
    if (!els.length) return;
    // Assembled at runtime so the address isn't a plain-text mailto in the HTML.
    // iCloud Hide My Email alias — forwards to Ben's inbox, revocable if it leaks.
    var u = ['basques', '.', 'crepes', '_7z'];
    var d = ['icloud', 'com'];
    var href = 'mai' + 'lto:' + u.join('') + '@' + d.join('.');
    for (var i = 0; i < els.length; i++) els[i].href = href;
})();

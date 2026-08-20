(function () {
    // Every element carrying the class gets the address - the footer contact
    // line puts one on every page, and /profiles/ has a second in its list.
    // (The old single #email-link id is covered too, for anything cached.)
    var els = document.querySelectorAll('.js-email, #email-link');
    if (!els.length) return;
    // The markup now carries the real mailto, so a reader with JavaScript off
    // gets a working contact link instead of one pointing at the home page.
    // This script only re-sets the same address on pages cached from before
    // that change, and can go once those have aged out.
    //
    // Duck Address alias - forwards to Ben's inbox, revocable if it leaks, and
    // not tied to a subscription the way the old iCloud alias was. Publishing it
    // in the clear costs nothing: .well-known/security.txt already does, at a
    // path scrapers fetch by name.
    var href = 'mailto:steam-gab-shape@duck.com';
    for (var i = 0; i < els.length; i++) els[i].href = href;
})();

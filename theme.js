/* Three-state theme control: system -> light -> dark -> system.
   "system" is stored as the absence of the key, so an existing 'light'/'dark' value
   left over from the previous two-state toggle keeps working untouched.
   The class is applied synchronously (this file is loaded in <head>, not deferred)
   so the page never paints the wrong theme first. */
(function () {
    var d = document.documentElement;
    var KEY = 'theme';
    var ORDER = ['system', 'light', 'dark'];
    var LABEL = {
        system: 'Theme: follow system',
        light: 'Theme: light',
        dark: 'Theme: dark',
    };

    function stored() {
        var v = null;
        try {
            v = localStorage.getItem(KEY);
        } catch (e) {
            /* private mode / storage disabled — fall through to system */
        }
        return v === 'light' || v === 'dark' ? v : 'system';
    }

    /* What the user actually sees, once "system" is resolved. */
    function effective(mode) {
        if (mode === 'light' || mode === 'dark') return mode;
        return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    function applyClass(mode) {
        d.classList.remove('light', 'dark');
        if (mode === 'light' || mode === 'dark') d.classList.add(mode);
    }

    function paintMeta(mode) {
        var color = effective(mode) === 'light' ? '#ffffff' : '#000000';
        var metas = document.querySelectorAll('meta[name="theme-color"]');
        for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', color);
    }

    function paintButton(mode) {
        var btn = document.getElementById('theme-toggle');
        if (!btn) return;
        btn.setAttribute('aria-label', LABEL[mode]);
        btn.setAttribute('title', LABEL[mode]);
        var icons = btn.querySelectorAll('.theme-ico');
        for (var i = 0; i < icons.length; i++) {
            var on = icons[i].getAttribute('data-theme-ico') === mode;
            icons[i].classList.toggle('is-active', on);
        }
    }

    // Synchronous, pre-paint.
    var current = stored();
    applyClass(current);

    function set(mode) {
        current = mode;
        try {
            if (mode === 'system') localStorage.removeItem(KEY);
            else localStorage.setItem(KEY, mode);
        } catch (e) {
            /* not persisting is survivable; the page still switches */
        }
        applyClass(mode);
        paintMeta(mode);
        paintButton(mode);
    }

    document.addEventListener('DOMContentLoaded', function () {
        paintMeta(current);
        paintButton(current);
        var btn = document.getElementById('theme-toggle');
        if (!btn) return;
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            set(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]);
        });
    });

    /* While following the system, track OS changes live so the address-bar colour
       doesn't drift out of sync with the page. */
    var mq = matchMedia('(prefers-color-scheme: light)');
    var onChange = function () {
        if (current === 'system') paintMeta('system');
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
})();

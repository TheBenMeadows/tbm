/* Two-state theme control, prayer-book model: the system preference is the
   silent default and never a button position; the control switches to the
   OTHER mode, and its visible label (set in CSS via #theme-toggle::before)
   names that target. Stored values: "light" | "dark"; absence of the key
   means follow the system. html.light / html.dark drive both the Tailwind
   override rules and the six role variables in src/input.css.

   Refinement over the three-state cycle this replaces: if the mode a tap
   switches to is what the system would give anyway, the override is CLEARED
   instead of stored — auto-follow returns without ever being a visible state.

   Loaded synchronously in <head> so the stored class applies before first
   paint and the page never flashes the wrong theme. */
(function () {
    var d = document.documentElement;
    var KEY = 'theme';

    function stored() {
        var v = null;
        try {
            v = localStorage.getItem(KEY);
        } catch (e) {
            /* private mode / storage disabled — fall through to system */
        }
        return v === 'light' || v === 'dark' ? v : null;
    }

    function systemTheme() {
        return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    /* What the visitor is actually looking at: an explicit choice, else the
       system. */
    function effective() {
        if (d.classList.contains('light')) return 'light';
        if (d.classList.contains('dark')) return 'dark';
        return systemTheme();
    }

    function applyClass(mode) {
        d.classList.remove('light', 'dark');
        if (mode === 'light' || mode === 'dark') d.classList.add(mode);
    }

    function paintMeta() {
        var color = effective() === 'light' ? '#ffffff' : '#000000';
        var metas = document.querySelectorAll('meta[name="theme-color"]');
        for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', color);
    }

    /* The visible label is CSS ::before content; only the accessible name is
       painted here, and it names the same target mode the label shows. */
    function paintButton() {
        var btn = document.getElementById('theme-toggle');
        if (!btn) return;
        var label = effective() === 'light' ? 'Switch to dark' : 'Switch to light';
        btn.setAttribute('aria-label', label);
        btn.title = label;
    }

    // Synchronous, pre-paint.
    applyClass(stored());

    document.addEventListener('DOMContentLoaded', function () {
        paintMeta();
        paintButton();
        var btn = document.getElementById('theme-toggle');
        if (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                var next = effective() === 'light' ? 'dark' : 'light';
                if (next === systemTheme()) {
                    // The explicit choice would match the system anyway —
                    // clear it so auto-follow silently returns.
                    applyClass(null);
                    try { localStorage.removeItem(KEY); } catch (e2) {}
                } else {
                    applyClass(next);
                    try { localStorage.setItem(KEY, next); } catch (e2) {}
                }
                paintMeta();
                paintButton();
            });
        }

        /* While following the system, track OS changes live so the label and
           address-bar colour don't drift out of sync with the page. */
        var mq = matchMedia('(prefers-color-scheme: light)');
        var onChange = function () {
            if (!stored()) {
                paintMeta();
                paintButton();
            }
        };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
    });
})();

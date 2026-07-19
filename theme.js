(function () {
    var d = document.documentElement;
    var stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') d.classList.add(stored);

    function effective() {
        if (d.classList.contains('light')) return 'light';
        if (d.classList.contains('dark')) return 'dark';
        return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    function paintMeta(theme) {
        var color = theme === 'light' ? '#ffffff' : '#000000';
        document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
            m.setAttribute('content', color);
        });
    }
    if (stored) paintMeta(stored);

    document.addEventListener('DOMContentLoaded', function () {
        var el = document.getElementById('theme-toggle');
        if (!el) return;
        el.addEventListener('click', function (e) {
            e.preventDefault();
            var next = effective() === 'light' ? 'dark' : 'light';
            d.classList.remove('light', 'dark');
            d.classList.add(next);
            localStorage.setItem('theme', next);
            paintMeta(next);
        });
    });
})();

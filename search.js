/* Site search. Two modes from one file:
 *   - overlay  — the header's search button, on every page
 *   - page     — /search/?q=…, so a result set is linkable and shareable
 *
 * The index is fetched lazily on first use, so a normal page load pays nothing for
 * search at all. No library: the corpus is ~11 KB, and staying dependency-free keeps
 * `script-src 'self'` intact (a WASM-based search would need 'wasm-unsafe-eval').
 */
(function () {
    var INDEX_URL = '/search-index.json';
    var MAX_RESULTS = 8;

    var docs = null;
    var loading = null;

    function load() {
        if (docs) return Promise.resolve(docs);
        if (loading) return loading;
        loading = fetch(INDEX_URL)
            .then(function (r) {
                if (!r.ok) throw new Error('index ' + r.status);
                return r.json();
            })
            .then(function (data) {
                docs = data.docs || [];
                return docs;
            });
        return loading;
    }

    function tokenize(q) {
        return q.toLowerCase().split(/\s+/).filter(Boolean);
    }

    /* Field weights: a hit in a title or a link label means far more than a hit
       somewhere in the body prose. Every token must match somewhere (AND). */
    function score(doc, tokens) {
        var title = (doc.title || '').toLowerCase();
        var heads = (doc.headings || []).join(' ').toLowerCase();
        var text = (doc.text || '').toLowerCase();
        var url = (doc.url || '').toLowerCase();
        var total = 0;

        for (var i = 0; i < tokens.length; i++) {
            var t = tokens[i];
            var hit = 0;
            if (title.indexOf(t) !== -1) hit += doc.kind === 'link' ? 6 : 5;
            if (heads.indexOf(t) !== -1) hit += 3;
            if (text.indexOf(t) !== -1) hit += 1;
            if (url.indexOf(t) !== -1) hit += 2;
            if (hit === 0) return 0; // AND
            total += hit;
        }
        // whole-phrase bonus
        var phrase = tokens.join(' ');
        if (title.indexOf(phrase) !== -1) total += 4;
        return total;
    }

    function search(q) {
        var tokens = tokenize(q);
        if (!tokens.length || !docs) return [];
        var out = [];
        for (var i = 0; i < docs.length; i++) {
            var s = score(docs[i], tokens);
            if (s > 0) out.push({ doc: docs[i], score: s });
        }
        out.sort(function (a, b) {
            return b.score - a.score;
        });
        return out.slice(0, MAX_RESULTS);
    }

    function snippet(doc, tokens) {
        var text = doc.text || '';
        if (!text) return '';
        var low = text.toLowerCase();
        var at = -1;
        for (var i = 0; i < tokens.length && at === -1; i++) at = low.indexOf(tokens[i]);
        if (at === -1) at = 0;
        var start = Math.max(0, at - 60);
        var end = Math.min(text.length, at + 140);
        return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
    }

    /* Built with textContent + real <mark> nodes rather than innerHTML — the query is
       user input and arrives from the URL on /search/. */
    function highlight(container, str, tokens) {
        var low = str.toLowerCase();
        var i = 0;
        while (i < str.length) {
            var best = -1;
            var bestLen = 0;
            for (var t = 0; t < tokens.length; t++) {
                var idx = low.indexOf(tokens[t], i);
                if (idx !== -1 && (best === -1 || idx < best)) {
                    best = idx;
                    bestLen = tokens[t].length;
                }
            }
            if (best === -1) {
                container.appendChild(document.createTextNode(str.slice(i)));
                return;
            }
            if (best > i) container.appendChild(document.createTextNode(str.slice(i, best)));
            var mark = document.createElement('mark');
            mark.className = 'search-hit';
            mark.textContent = str.slice(best, best + bestLen);
            container.appendChild(mark);
            i = best + bestLen;
        }
    }

    function isExternal(url) {
        return /^https?:\/\//.test(url);
    }

    function renderInto(list, results, tokens, opts) {
        list.textContent = '';
        for (var i = 0; i < results.length; i++) {
            var doc = results[i].doc;
            var li = document.createElement('li');

            var a = document.createElement('a');
            a.href = doc.url;
            a.className = 'search-result';
            if (isExternal(doc.url)) {
                a.target = '_blank';
                a.rel = 'noopener';
            }

            var title = document.createElement('span');
            title.className = 'search-result-title';
            highlight(title, doc.title || doc.url, tokens);
            a.appendChild(title);

            var meta = document.createElement('span');
            meta.className = 'search-result-meta';
            meta.textContent = doc.kind === 'link'
                ? 'Link · ' + doc.url.replace(/^https?:\/\//, '').replace(/\/$/, '')
                : doc.url;
            a.appendChild(meta);

            var snip = snippet(doc, tokens);
            if (snip) {
                var p = document.createElement('span');
                p.className = 'search-result-snippet';
                highlight(p, snip, tokens);
                a.appendChild(p);
            }

            li.appendChild(a);
            list.appendChild(li);
        }
        if (opts && opts.empty && !results.length) list.appendChild(opts.empty());
    }

    function messageItem(text) {
        var li = document.createElement('li');
        li.className = 'search-empty';
        li.textContent = text;
        return li;
    }

    // ---------------------------------------------------------------- overlay ----
    function buildOverlay() {
        var wrap = document.createElement('div');
        wrap.id = 'search-overlay';
        wrap.className = 'search-overlay';
        wrap.hidden = true;
        wrap.setAttribute('role', 'dialog');
        wrap.setAttribute('aria-modal', 'true');
        wrap.setAttribute('aria-label', 'Search this site');

        var panel = document.createElement('div');
        panel.className = 'search-panel';

        var form = document.createElement('form');
        form.className = 'search-form';
        form.setAttribute('role', 'search');
        form.action = '/search/';
        form.method = 'get';

        var input = document.createElement('input');
        input.type = 'search';
        input.name = 'q';
        input.id = 'search-input';
        input.className = 'search-input';
        input.setAttribute('placeholder', 'Search this site…');
        input.setAttribute('aria-label', 'Search this site');
        input.setAttribute('autocomplete', 'off');

        var close = document.createElement('button');
        close.type = 'button';
        close.className = 'search-close';
        close.setAttribute('aria-label', 'Close search');
        close.textContent = 'Esc';

        form.appendChild(input);
        form.appendChild(close);

        var list = document.createElement('ul');
        list.className = 'search-results';

        panel.appendChild(form);
        panel.appendChild(list);
        wrap.appendChild(panel);
        document.body.appendChild(wrap);

        var lastFocus = null;

        function open() {
            lastFocus = document.activeElement;
            wrap.hidden = false;
            document.documentElement.classList.add('search-open');
            input.focus();
            input.select();
            load().then(run).catch(function () {
                list.textContent = '';
                list.appendChild(messageItem('Search is unavailable right now.'));
            });
        }

        function closeIt() {
            /* Blur before hiding. Hiding an element that still holds focus leaves
               document.activeElement pointing at something invisible, which both
               strands screen-reader focus and makes the "/" shortcut think the user
               is typing in a field — so search could never be reopened with "/". */
            if (document.activeElement && wrap.contains(document.activeElement)) {
                document.activeElement.blur();
            }
            wrap.hidden = true;
            document.documentElement.classList.remove('search-open');
            if (lastFocus && lastFocus.focus && lastFocus !== document.body && document.contains(lastFocus)) {
                lastFocus.focus();
            }
        }

        function run() {
            var q = input.value.trim();
            if (!q) {
                list.textContent = '';
                return;
            }
            if (!docs) return;
            var tokens = tokenize(q);
            renderInto(list, search(q), tokens, {
                empty: function () {
                    return messageItem('No results for “' + q + '”.');
                },
            });
        }

        input.addEventListener('input', run);
        close.addEventListener('click', closeIt);
        form.addEventListener('submit', function (e) {
            // With JS live we already show results; let the form fall through to
            // /search/ only when the user explicitly wants a linkable page.
            e.preventDefault();
            var q = input.value.trim();
            if (q) window.location.href = '/search/?q=' + encodeURIComponent(q);
        });
        wrap.addEventListener('click', function (e) {
            if (e.target === wrap) closeIt();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !wrap.hidden) {
                closeIt();
                return;
            }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                wrap.hidden ? open() : closeIt();
                return;
            }
            if (e.key === '/' && wrap.hidden) {
                var el = document.activeElement;
                var tag = el ? el.tagName : '';
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;
                e.preventDefault();
                open();
            }
        });

        // arrow-key navigation between results
        wrap.addEventListener('keydown', function (e) {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            var links = list.querySelectorAll('a');
            if (!links.length) return;
            e.preventDefault();
            var idx = -1;
            for (var i = 0; i < links.length; i++) if (links[i] === document.activeElement) idx = i;
            if (e.key === 'ArrowDown') idx = idx + 1 >= links.length ? 0 : idx + 1;
            else idx = idx <= 0 ? links.length - 1 : idx - 1;
            links[idx].focus();
        });

        return { open: open, close: closeIt };
    }

    // ------------------------------------------------------------- /search/ ------
    function initPage(root) {
        var input = document.getElementById('search-page-input');
        var list = document.getElementById('search-page-results');
        var status = document.getElementById('search-page-status');
        var params = new URLSearchParams(window.location.search);
        var q0 = (params.get('q') || '').trim();
        if (q0) input.value = q0;

        function run(pushUrl) {
            var q = input.value.trim();
            list.textContent = '';
            if (!q) {
                status.textContent = 'Type to search.';
                return;
            }
            if (!docs) return;
            var results = search(q);
            status.textContent = results.length
                ? results.length + (results.length === 1 ? ' result' : ' results') + ' for “' + q + '”'
                : 'No results for “' + q + '”.';
            renderInto(list, results, tokenize(q), null);
            if (pushUrl) {
                var next = '/search/?q=' + encodeURIComponent(q);
                window.history.replaceState(null, '', next);
            }
        }

        status.textContent = 'Loading…';
        load().then(function () {
            run(false);
        }).catch(function () {
            status.textContent = 'Search is unavailable right now.';
        });

        input.addEventListener('input', function () {
            run(true);
        });
        root.addEventListener('submit', function (e) {
            e.preventDefault();
            run(true);
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var pageRoot = document.getElementById('search-page-form');
        if (pageRoot) initPage(pageRoot);

        var btn = document.getElementById('search-open');
        if (!btn) return;
        var overlay = buildOverlay();
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            overlay.open();
        });
    });
})();

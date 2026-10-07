/* Mounts Hairline figures into the cards on /projects/ and /experiments/.
   Each figure module (loaded after this classic script) calls window.hairline
   with its figure; it mounts into the element with data-hl="<figure name>",
   at the figure's middle range value, with no slider. The read-out goes to
   the .hl-read sibling; data-rest renames the figure's "rest" state.
   Colours come from the --hairline-* variables in src/input.css. */
window.hairline = function (figure) {
    var stage = document.querySelector('[data-hl="' + figure.name + '"]');
    if (!stage || !window.HL) return;
    HL.inject(document);
    stage.setAttribute('data-hairline', figure.name);
    stage.setAttribute('role', 'img');
    stage.setAttribute('aria-label', figure.means);
    var svg = HL.mk('svg', { viewBox: '0 0 400 320', 'aria-hidden': 'true' }, stage);
    var out = stage.parentNode.querySelector('.hl-read');
    var restLabel = stage.getAttribute('data-rest');
    var read = {
        get textContent() {
            return out ? out.textContent : '';
        },
        set textContent(v) {
            if (out) out.textContent = v === 'rest' && restLabel ? restLabel : v;
        },
    };
    read.textContent = 'rest';
    stage.hairline = figure.mount({ stage: stage, svg: svg, read: read }, figure.range[1]);
};

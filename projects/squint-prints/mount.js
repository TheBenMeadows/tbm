/* Mounts the Squint "Prints" figure into #squint-prints on /projects/.
   prints.js (a module, so it runs after this) calls window.hairline with its
   figure; the stagger is fixed at the figure's middle value, with no slider.
   Colours come from the --hairline-* variables in src/input.css, which follow
   the site's light and dark themes. */
window.hairline = function (figure) {
    var stage = document.getElementById('squint-prints');
    if (!stage || !window.HL) return;
    HL.inject(document);
    stage.setAttribute('data-hairline', figure.name);
    stage.setAttribute('role', 'img');
    stage.setAttribute('aria-label', figure.means);
    var svg = HL.mk('svg', { viewBox: '0 0 400 320', 'aria-hidden': 'true' }, stage);
    var read = document.getElementById('squint-prints-read');
    stage.hairline = figure.mount({ stage: stage, svg: svg, read: read }, figure.range[1]);
};

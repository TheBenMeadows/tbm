/* Terms a reader can open, on blog posts (the [[term::explanation]] syntax in
 * scripts/build-blog.mjs). Each explanation is already in the page, in parentheses
 * after its term. This folds it away and turns the term into a button that opens
 * it in place. Without this script the explanations simply stay visible. */
(function () {
    "use strict";
    var n = 0;
    document.querySelectorAll(".peek").forEach(function (gloss) {
        var term = peek.querySelector(".gloss-term");
        var body = peek.querySelector(".gloss-body");
        if (!term || !body) return;
        var button = document.createElement("button");
        button.type = "button";
        button.className = "gloss-term";
        while (term.firstChild) button.appendChild(term.firstChild);
        body.id = "gloss-" + (++n);
        body.hidden = true;
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-controls", body.id);
        button.addEventListener("click", function () {
            var open = body.hidden;
            body.hidden = !open;
            button.setAttribute("aria-expanded", String(open));
        });
        term.replaceWith(button);
        peek.classList.add("gloss-on");
    });
})();

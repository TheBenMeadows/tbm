// Click a work's image to see it larger. Motion pieces link to an MP4 or an
// animated SVG, so the enlarged view plays them. Without this script the link
// opens the file itself.
(() => {
    const dialog = document.getElementById("zoom");
    if (!dialog || typeof dialog.showModal !== "function") return;
    const img = dialog.querySelector("img");
    const video = dialog.querySelector("video");
    document.addEventListener("click", (e) => {
        const link = e.target.closest("a.zoom");
        if (!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        const thumb = link.querySelector("img");
        const label = thumb ? thumb.alt : "";
        if (link.pathname.endsWith(".mp4")) {
            video.setAttribute("aria-label", label);
            if (thumb) video.poster = thumb.currentSrc || thumb.src;
            video.src = link.href;
            video.hidden = false;
            dialog.showModal();
            video.play().catch(() => {});
        } else {
            img.alt = label;
            img.src = link.href;
            img.hidden = false;
            dialog.showModal();
        }
    });
    dialog.addEventListener("click", (e) => {
        if (e.target !== dialog.querySelector("button")) dialog.close();
    });
    dialog.addEventListener("close", () => {
        video.pause();
        video.removeAttribute("src");
        video.removeAttribute("poster");
        video.load();
        video.hidden = true;
        img.removeAttribute("src");
        img.hidden = true;
    });
})();

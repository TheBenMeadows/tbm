// Click a work's image to see it larger. Without this script the link opens the image file.
(() => {
    const dialog = document.getElementById("zoom");
    if (!dialog || typeof dialog.showModal !== "function") return;
    const img = dialog.querySelector("img");
    document.addEventListener("click", (e) => {
        const link = e.target.closest("a.zoom");
        if (!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        const thumb = link.querySelector("img");
        img.alt = thumb ? thumb.alt : "";
        img.src = link.href;
        dialog.showModal();
    });
    dialog.addEventListener("click", (e) => {
        if (e.target !== dialog.querySelector("button")) dialog.close();
    });
    dialog.addEventListener("close", () => img.removeAttribute("src"));
})();

// Simple glitch effect intensity randomizer
const glitchElement = document.querySelector('.glitch');
setInterval(() => {
    const r1 = Math.random() * 10;
    const r2 = Math.random() * 10;
    if (glitchElement) {
        glitchElement.style.setProperty('--after-top', `${r1}px`);
        glitchElement.style.setProperty('--before-top', `-${r2}px`);
    }
}, 200);

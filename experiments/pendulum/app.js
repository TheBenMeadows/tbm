/**
 * Pursuit of Equilibrium - Algorithm Simulator
 */

const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvas-container');

// State
let animationId;
let time = 0;
let isSimulating = false;

// Lock State: true = locked (don't change), false = unlocked (randomize allowed)
const locks = {
    ratio: false,
    offset: false,
    phase: true,
    ampX: false,
    ampY: false,
    dampingX: false,
    dampingY: false,
    cycles: false,
    swingTime: true,
    lineType: false,
    color: false
};

// Conservative Color Themes (Background, Line)
const themes = [
    { bg: "#050505", line: "rgba(255, 255, 255, 0.6)" }, // Default Void
    { bg: "#0f172a", line: "rgba(203, 213, 225, 0.6)" }, // Slate/Ice
    { bg: "#1a1a1a", line: "rgba(251, 191, 36, 0.6)" },  // Gold/Dark
    { bg: "#2b1b17", line: "rgba(253, 186, 116, 0.6)" }, // Coffee/Amber
    { bg: "#002b36", line: "rgba(133, 153, 0, 0.6)" },   // Solarized Dark/Green
    { bg: "#f0f9ff", line: "rgba(12, 74, 110, 0.6)" },   // Paper/Ink (Light)
    { bg: "#fafafa", line: "rgba(23, 23, 23, 0.6)" },    // Gallery (Light)
    { bg: "#18181b", line: "rgba(167, 139, 250, 0.6)" }, // Midnight/Purple
    { bg: "#020617", line: "rgba(56, 189, 248, 0.6)" }   // Deep Space/Cyan
];

// Configuration Object
const config = {
    basePeriod: 2.0, // Fixed base
    ratio: 1.5,
    offset: 0.005,
    
    ampX: 1.0,
    ampY: 1.0,
    
    dampingX: 0.005, 
    dampingY: 0.005,
    
    phaseY: Math.PI / 2, // 90 degrees
    
    speed: 100,    
    maxTime: 200, // Derived from cycles
    
    scale: 150,
    zoom: 1.0,
    lineType: 'solid',
    
    // Colors
    bgColor: "#050505",
    lineColor: "rgba(255, 255, 255, 0.6)"
};

// UI Elements Cache
const ui = {
    ratio: document.getElementById('ratio'),
    offset: document.getElementById('offset'),
    phase: document.getElementById('phase'),
    ampX: document.getElementById('amp-x'),
    ampY: document.getElementById('amp-y'),
    dampingX: document.getElementById('damping-x'),
    dampingY: document.getElementById('damping-y'),
    cycles: document.getElementById('cycles'),
    swingTime: document.getElementById('swing-time'),
    lineType: document.getElementById('line-type'),
    zoom: document.getElementById('zoom'),
    status: document.getElementById('status'),
    // Labels
    lblRatio: document.getElementById('val-ratio'),
    lblOffset: document.getElementById('val-offset'),
    lblPhase: document.getElementById('val-phase'),
    lblAmpX: document.getElementById('val-amp-x'),
    lblAmpY: document.getElementById('val-amp-y'),
    lblDampingX: document.getElementById('val-damping-x'),
    lblDampingY: document.getElementById('val-damping-y'),
    lblCycles: document.getElementById('val-cycles'),
    lblSwingTime: document.getElementById('val-swing-time'),
    lblZoom: document.getElementById('val-zoom'),
    // Colors
    previewBg: document.getElementById('color-preview-bg'),
    previewLine: document.getElementById('color-preview-line'),
    titleText: document.getElementById('title-text')
};

function toggleLock(paramKey) {
    locks[paramKey] = !locks[paramKey];
    const btn = document.getElementById(`lock-${paramKey}`);
    const iconUnlocked = btn.querySelector('.icon-unlocked');
    const iconLocked = btn.querySelector('.icon-locked');
    
    if (locks[paramKey]) {
        btn.classList.add('text-red-500');
        btn.classList.remove('text-gray-600');
        iconUnlocked.classList.add('hidden');
        iconUnlocked.classList.remove('block');
        iconLocked.classList.add('block');
        iconLocked.classList.remove('hidden');
    } else {
        btn.classList.add('text-gray-600');
        btn.classList.remove('text-red-500');
        iconUnlocked.classList.add('block');
        iconUnlocked.classList.remove('hidden');
        iconLocked.classList.add('hidden');
        iconLocked.classList.remove('block');
    }
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    const minDim = Math.min(rect.width, rect.height);
    // Lowered scale factor from 0.85 to 0.42 to accommodate Amplitude 2.0
    config.scale = (minDim / 2) * 0.42; 
    
    if(isSimulating) startSimulation();
}

function getPosition(t) {
    // Physics Engine
    const periodX = config.basePeriod;
    const periodY = (config.basePeriod * config.ratio) + config.offset;

    const omegaX = 2 * Math.PI / periodX;
    const omegaY = 2 * Math.PI / periodY;
    
    const decayX = Math.exp(-config.dampingX * t);
    const decayY = Math.exp(-config.dampingY * t);
    
    const x = config.ampX * decayX * Math.sin(omegaX * t);
    // Phase Offset is applied to Y
    const y = config.ampY * decayY * Math.sin(omegaY * t + config.phaseY);
    
    return { x, y };
}

function drawStep() {
    if (!isSimulating) return;

    ctx.strokeStyle = config.lineColor; 
    ctx.lineWidth = 0.8;

    if (config.lineType === 'dashed') {
        const dashSize = 2 * (window.devicePixelRatio || 1);
        const gapSize = 4 * (window.devicePixelRatio || 1);
        ctx.setLineDash([dashSize, gapSize]);
    } else {
        ctx.setLineDash([]);
    }

    ctx.beginPath();

    // Calculate effective scale including zoom
    const effectiveScale = config.scale * config.zoom;

    for (let i = 0; i < config.speed; i++) {
        const posPrev = getPosition(time);
        
        const cx = canvas.width / (2 * (window.devicePixelRatio || 1));
        const cy = canvas.height / (2 * (window.devicePixelRatio || 1));
        
        const screenXPrev = cx + posPrev.x * effectiveScale;
        const screenYPrev = cy + posPrev.y * effectiveScale;

        ctx.moveTo(screenXPrev, screenYPrev);

        time += 0.02; // Fixed physics timestep

        const posNext = getPosition(time);
        const screenXNext = cx + posNext.x * effectiveScale;
        const screenYNext = cy + posNext.y * effectiveScale;

        ctx.lineTo(screenXNext, screenYNext);

        if (time > config.maxTime) {
            isSimulating = false;
            ui.status.innerText = "COMPLETE";
            ui.status.className = "text-gray-500";
            cancelAnimationFrame(animationId);
            return;
        }
    }
    
    ctx.stroke();
    animationId = requestAnimationFrame(drawStep);
}

function startSimulation() {
    isSimulating = true;
    time = 0;
    
    // Update Background
    container.style.backgroundColor = config.bgColor;
    ui.previewBg.style.backgroundColor = config.bgColor;
    ui.previewLine.style.backgroundColor = config.lineColor;
    
    // Update Text Contrast
    // Simple heuristic: if bg is hex white-ish, make text black
    const isLight = config.bgColor === "#f0f9ff" || config.bgColor === "#fafafa";
    if(isLight) {
         ui.titleText.classList.remove('text-white');
         ui.titleText.classList.add('text-black');
    } else {
         ui.titleText.classList.remove('text-black');
         ui.titleText.classList.add('text-white');
    }

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    
    ui.status.innerText = "GENERATING...";
    ui.status.className = "text-green-500 animate-pulse";
    
    if (animationId) cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(drawStep);
}

function updateConfigFromUI() {
    config.ratio = parseFloat(ui.ratio.value);
    config.offset = parseFloat(ui.offset.value);
    config.ampX = parseFloat(ui.ampX.value);
    config.ampY = parseFloat(ui.ampY.value);
    config.dampingX = parseFloat(ui.dampingX.value);
    config.dampingY = parseFloat(ui.dampingY.value);
    config.phaseY = parseFloat(ui.phase.value) * (Math.PI / 180);
    
    const cycles = parseInt(ui.cycles.value);
    config.maxTime = cycles * config.basePeriod;
    
    config.speed = parseInt(ui.swingTime.value);
    config.zoom = parseFloat(ui.zoom.value);
    config.lineType = ui.lineType.value;

    // Update Labels
    ui.lblRatio.innerText = config.ratio.toFixed(3);
    ui.lblOffset.innerText = config.offset.toFixed(3);
    ui.lblPhase.innerText = ui.phase.value + "°";
    ui.lblAmpX.innerText = config.ampX.toFixed(2);
    ui.lblAmpY.innerText = config.ampY.toFixed(2);
    ui.lblDampingX.innerText = config.dampingX.toFixed(4);
    ui.lblDampingY.innerText = config.dampingY.toFixed(4);
    ui.lblCycles.innerText = cycles;
    ui.lblSwingTime.innerText = config.speed + "x";
    ui.lblZoom.innerText = config.zoom.toFixed(1) + "x";
}

function resetToDefault() {
    ui.ratio.value = 1.5;
    ui.offset.value = 0.005;
    ui.phase.value = 90;
    ui.ampX.value = 1.0;
    ui.ampY.value = 1.0;
    ui.dampingX.value = 0.005;
    ui.dampingY.value = 0.005;
    ui.cycles.value = 100;
    ui.swingTime.value = 100;
    ui.lineType.value = 'solid';
    ui.zoom.value = 1.0;
    
    // Reset to default Theme
    config.bgColor = themes[0].bg;
    config.lineColor = themes[0].line;
    
    updateConfigFromUI();
    startSimulation();
}

function randomizeParams() {
    // 1. Pick a harmonic ratio
    if (!locks.ratio) {
        const ratios = [
            1.0, 1.5, 1.333, 2.0, 0.666, 0.75, 1.25, 2.5, 3.0, 
            3.5, 4.0, 5.0, 1.666, 1.75, 2.25, 2.333, 2.666,
            0.8, 0.6, 1.2, 1.4, 1.6, 1.8, 2.4, 2.8, 3.2, 4.5, 5.5, 6.0
        ];
        const randomRatio = ratios[Math.floor(Math.random() * ratios.length)];
        ui.ratio.value = randomRatio;
    }

    // 2. Random small offset 
    if (!locks.offset) {
        ui.offset.value = Math.random() * 0.02;
    }

    // 3. Random Phase 
    if (!locks.phase) {
        const randomPhase = Math.floor(Math.random() * 360);
        ui.phase.value = randomPhase;
    }

    // 4. Random Amplitudes 
    if (!locks.ampX) {
        ui.ampX.value = 0.8 + Math.random() * 0.6;
    }
    if (!locks.ampY) {
        ui.ampY.value = 0.8 + Math.random() * 0.6;
    }

    // 5. Random Damping 
    if (!locks.dampingX) {
         ui.dampingX.value = 0.002 + Math.random() * 0.01;
    }
    if (!locks.dampingY) {
         ui.dampingY.value = 0.002 + Math.random() * 0.01;
    }
    
    // 6. Random Cycle Count 
    if (!locks.cycles) {
        ui.cycles.value = 80 + Math.floor(Math.random() * 220);
    }

    // 7. Random Line Type 
    if (!locks.lineType) {
        ui.lineType.value = Math.random() > 0.8 ? 'dashed' : 'solid';
    }
    
    // 8. Random Color Theme
    if (!locks.color) {
        const theme = themes[Math.floor(Math.random() * themes.length)];
        config.bgColor = theme.bg;
        config.lineColor = theme.line;
    }

    updateConfigFromUI();
    startSimulation();
}

// Listeners
window.addEventListener('resize', resizeCanvas);
document.getElementById('btn-generate').addEventListener('click', startSimulation);
document.getElementById('btn-random').addEventListener('click', randomizeParams);

ui.lineType.addEventListener('change', () => {
    updateConfigFromUI();
    startSimulation();
});

const inputs = document.querySelectorAll('input[type=range]');
inputs.forEach(input => {
    input.addEventListener('input', () => {
        updateConfigFromUI();
        startSimulation(); 
    });
});

// --- PNG Export ---
document.getElementById('btn-save-png').addEventListener('click', () => {
    const exportCanvas = document.createElement('canvas');
    const exportCtx = exportCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const paddingBottom = 120 * dpr;
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height + paddingBottom;

    // Use current background color
    exportCtx.fillStyle = config.bgColor;
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    exportCtx.drawImage(canvas, 0, 0);

    // Text contrast logic
    // Parse hex/rgba to check brightness or just use specific colors
    // Simpler: Use the line color for text, but opaque
    let textColor = config.lineColor;
    if(textColor.includes('rgba')) {
        // Replace alpha 0.6 with 1.0 for readability
        textColor = textColor.replace(/[\d\.]+\)$/, "1.0)");
    }

    exportCtx.fillStyle = textColor;
    exportCtx.font = `${10 * dpr}px 'Courier New', monospace`;
    exportCtx.textAlign = 'left';
    exportCtx.textBaseline = 'top';

    const textLines = [
        `Ratio: ${config.ratio.toFixed(3)} | Offset: ${config.offset.toFixed(3)} | Phase: ${ui.phase.value}°`,
        `Amp X: ${config.ampX.toFixed(2)} | Amp Y: ${config.ampY.toFixed(2)}`,
        `Damping X: ${config.dampingX.toFixed(4)} | Damping Y: ${config.dampingY.toFixed(4)}`,
        `Cycles: ${ui.cycles.value} | Line: ${config.lineType.toUpperCase()}`
    ];

    let textY = canvas.height + (20 * dpr);
    const textX = 20 * dpr;
    const lineHeight = 14 * dpr;

    textLines.forEach(line => {
        exportCtx.fillText(line, textX, textY);
        textY += lineHeight;
    });

    const link = document.createElement('a');
    link.download = 'thebenmeadows-pendulum.png';
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
});

// --- SVG Export ---
document.getElementById('btn-save-svg').addEventListener('click', () => {
    const width = 1000;
    const height = 1000;
    const cx = width / 2;
    const cy = height / 2;
    const scale = 400 * config.zoom; // SVG scale unit
    
    // Construct SVG Path
    let pathData = "";
    let t = 0;
    const step = 0.02;
    
    // Initial Move
    const startPos = getPosition(0);
    pathData += `M ${cx + startPos.x * scale} ${cy + startPos.y * scale} `;
    
    // Loop
    while (t < config.maxTime) {
        t += step;
        const pos = getPosition(t);
        pathData += `L ${cx + pos.x * scale} ${cy + pos.y * scale} `;
    }

    // Determine Stroke (opaque for SVG)
    let strokeColor = config.lineColor;
    if(strokeColor.includes('rgba')) {
        strokeColor = strokeColor.replace(/[\d\.]+\)$/, "1.0)");
    }
    
    // Dash Array
    let dashAttr = "";
    if(config.lineType === 'dashed') {
        dashAttr = 'stroke-dasharray="4 8"';
    }

    const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="background-color: ${config.bgColor}">
    <rect width="100%" height="100%" fill="${config.bgColor}"/>
    <path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="0.5" ${dashAttr} />
    <text x="20" y="${height - 20}" fill="${strokeColor}" font-family="Courier New" font-size="12">
Ratio: ${config.ratio.toFixed(3)} | Offset: ${config.offset.toFixed(3)} | Cycles: ${ui.cycles.value}
    </text>
</svg>`.trim();

    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = "thebenmeadows-pendulum.svg";
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
});

// Init
resizeCanvas();
updateConfigFromUI();
startSimulation();

// Lock toggles and reset were inline onclick= attributes in the original
// single-file page; the site CSP (script-src 'self') forbids inline handlers,
// so they are wired up here instead.
Object.keys(locks).forEach((key) => {
    const btn = document.getElementById(`lock-${key}`);
    if (btn) btn.addEventListener('click', () => toggleLock(key));
});
document.getElementById('btn-reset').addEventListener('click', resetToDefault);

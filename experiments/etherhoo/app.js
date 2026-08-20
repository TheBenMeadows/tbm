// --- MOCK DATA GENERATOR ---
// Generates consistent-looking fake data to ensure the UI works without API keys/CORS.

function randomHex(length) {
    let result = '0x';
    const characters = '0123456789abcdef';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function formatHash(hash) {
    return hash.substring(0, 8) + '...' + hash.substring(hash.length - 6);
}

function randomEth() {
    return (Math.random() * 5).toFixed(4);
}

let currentBlock = 19284750;

// --- RENDER FUNCTIONS ---

function addBlock() {
    currentBlock++;
    const tbody = document.getElementById('blocksBody');
    const row = document.createElement('tr');
    
    const miner = randomHex(40);
    const reward = (0.0 + Math.random() * 0.1).toFixed(5);
    
    row.innerHTML = `
        <td><a href="#" data-q="${currentBlock}">${currentBlock}</a></td>
        <td><span class="hash"><a href="#" data-q="${miner}">${formatHash(miner)}</a></span> <span class="tiny gray">(Builder)</span></td>
        <td>${reward} ETH</td>
        <td class="tiny gray">Just now</td>
    `;
    
    tbody.insertBefore(row, tbody.firstChild);
    if (tbody.children.length > 8) tbody.removeChild(tbody.lastChild);
}

function addTx() {
    const tbody = document.getElementById('txBody');
    const row = document.createElement('tr');
    
    const txHash = randomHex(64);
    const from = randomHex(40);
    const to = randomHex(40);
    const val = Math.random() > 0.7 ? randomEth() : "0.0000";
    
    row.innerHTML = `
        <td><span class="hash"><a href="#" data-q="${txHash}">${formatHash(txHash)}</a></span></td>
        <td><span class="hash"><a href="#" data-q="${from}">${formatHash(from)}</a></span></td>
        <td><span class="hash"><a href="#" data-q="${to}">${formatHash(to)}</a></span></td>
        <td>${val} ETH</td>
    `;
    
    tbody.insertBefore(row, tbody.firstChild);
    if (tbody.children.length > 8) tbody.removeChild(tbody.lastChild);
}

// --- MARKET TICKER ---
let price = 2450.32;
function updatePrice() {
    const change = (Math.random() - 0.5) * 2;
    price += change;
    const el = document.getElementById('ethPrice');
    el.innerText = '$' + price.toFixed(2);
    el.className = change >= 0 ? 'green' : 'red';
}

// --- SEARCH LOGIC ---
function handleSearch(e) {
    e.preventDefault();
    const val = document.getElementById('searchInput').value.trim();
    if(!val) return;
    search(val);
}

function search(query) {
    // Switch view
    document.getElementById('mainView').style.display = 'none';
    document.getElementById('resultView').style.display = 'block';
    
    // Mocking results
    document.getElementById('resAddress').innerText = query.length > 20 ? query : randomHex(40);
    document.getElementById('resBalance').innerText = (Math.random() * 100).toFixed(4);
    document.getElementById('resNonce').innerText = Math.floor(Math.random() * 500);

    // Generate fake history for this address
    const tbody = document.getElementById('resTxBody');
    tbody.innerHTML = ''; // Clear old
    for(let i=0; i<5; i++) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="hash"><a href="#">${formatHash(randomHex(64))}</a></td>
            <td><span style="background:#EEE; border:1px solid #CCC; padding:0 2px; font-size:10px;">Transfer</span></td>
            <td class="tiny">${i*5} mins ago</td>
            <td class="hash">${formatHash(randomHex(40))}</td>
            <td class="hash">IN</td>
            <td>${(Math.random()).toFixed(3)} ETH</td>
        `;
        tbody.appendChild(row);
    }

    document.getElementById('statusArea').style.display = 'block';
    document.getElementById('statusArea').innerText = `Displaying results for: ${query}`;
}

function clearSearch() {
    document.getElementById('mainView').style.display = 'block';
    document.getElementById('resultView').style.display = 'none';
    document.getElementById('statusArea').style.display = 'none';
    document.getElementById('searchInput').value = '';
}

// --- INIT ---
// Populate initial tables
for(let i=0; i<8; i++) { addBlock(); addTx(); }

// Start loops
/* WCAG 2.2.2: these three tickers start on load and run forever with no pause
   control, mutating two tables every 0.8s and 3.5s. Anyone who has asked for
   less motion gets the page as rendered, without the churn. */
if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setInterval(addBlock, 3500); // New block every 3.5s (simulated)
    setInterval(addTx, 800);     // New tx every 0.8s
    setInterval(updatePrice, 2000);
}

// --- CSP WIRING ---
// The original single-file page used inline onclick=/onsubmit= attributes,
// including ones injected through innerHTML; the site CSP (script-src 'self')
// forbids all of them. Static handlers attach here; the rows the generators
// keep injecting carry data-q attributes handled by one delegated listener.
document.getElementById('searchForm').addEventListener('submit', handleSearch);
document.getElementById('btn-clear').addEventListener('click', clearSearch);
document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-q]');
    if (link) {
        e.preventDefault();
        search(link.dataset.q);
    }
});

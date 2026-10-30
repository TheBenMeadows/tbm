// Birds planner: which bird/sanctuary pairs a wallet still needs, who is in each
// sanctuary right now, and who will be there if an observation lands in the next block.
(function () {
    const RPC = 'https://ethereum-rpc.publicnode.com';
    const OBS = '0xcf24e99e8706ff84f90e92e73ad644a1e17beb45';
    const BIRDS = '0x75de5bc35248026fabcb2382cf322bc79dfd1a8c';
    const SEL = {
        fee: '0x35662b99', epoch: '0x06c106f9', epochTs: '0x6103ed2e', state: '0x86b0b2c0',
        enabled: '0xe74fd5c8', name: '0x310495ab', observe: '0xca749478', departed: '0xb141d93c',
        balances: '0x4e1273f4',
    };
    const COPRIMES_INV = [0x35, 0x4f, 0x51, 0x57, 0x3f, 0x45, 0x47, 0x61, 0x49, 0x3b, 0x3d, 0x07, 0x53, 0x31,
        0x33, 0x11, 0x5d, 0x27, 0x29, 0x1b, 0x03, 0x1d, 0x1f, 0x25, 0x0d, 0x13, 0x15, 0x2f];
    const HOME_BIRDS = 30;
    const MAX_SANCTUARIES = 10;
    const COOLDOWN_S = 10; // BirdsNFT OBSERVER_MIGRATION_COOLDOWN, global

    const $ = (id) => document.getElementById(id);
    const pad = (n) => BigInt(n).toString(16).padStart(64, '0');
    const hexToBytes = (h) => Uint8Array.from(h.replace(/^0x/, '').match(/../g) || [], (x) => parseInt(x, 16));
    const toHex = (b) => '0x' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const word = (r, i = 0) => (r && r.length >= 2 + 64 * (i + 1) ? BigInt('0x' + r.slice(2 + 64 * i, 66 + 64 * i)) : null);
    const short = (a) => a.slice(0, 6) + '…' + a.slice(-4);

    let names = {};
    let sanctuaries = [1, 2, 3, 4, 5]; // replaced by the enabled set on load
    let have = new Set(); // "sid:bid" pairs the wallet holds a token for
    let account = null; // address whose pairs are shown
    let accountLabel = ''; // "name.eth → " when the address came from ENS
    let selection = 0; // bumps on every new address, so only the latest lookup lands
    let connected = null; // wallet that can send
    let lastBlock = 0;
    let fee = 0n;
    let coolUntil = 0; // unix seconds
    let pending = null; // "sid:bid" while a send is open
    let busy = false;

    const timeout = () => (AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined);
    async function rpc(method, params) {
        const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: timeout() });
        const j = await r.json();
        if (j.error) { const err = new Error(j.error.message); err.data = j.error.data; throw err; }
        return j.result;
    }
    // ENS v1 + v2 names, through the Universal Resolver (ens.js).
    const ens = window.makeEnsResolver((to, data) => rpc('eth_call', [{ to, data }, 'latest']), window.keccak256);
    async function rpcBatch(calls) {
        const body = calls.map((c, i) => ({ jsonrpc: '2.0', id: i, method: c[0], params: c[1] }));
        const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: timeout() });
        const j = await r.json();
        if (!Array.isArray(j)) throw new Error('unexpected RPC reply');
        return calls.map((_, i) => {
            const x = j.find((y) => y.id === i);
            if (!x || x.error || x.result == null) throw new Error((x && x.error && x.error.message) || 'missing result ' + i);
            return x.result;
        });
    }
    const call = (to, data, tag = 'latest') => ['eth_call', [{ to, data }, tag]];

    function decodeString(hex) {
        const len = word(hex, 1);
        if (len === null) return '';
        const b = hexToBytes(hex);
        return new TextDecoder().decode(b.slice(64, 64 + Number(len)));
    }

    // Layout produced by an observation that lands in the block after `prevHash`.
    function forecast(prevHash, nextEpoch) {
        const input = new Uint8Array(60);
        input.set(hexToBytes(prevHash), 0);
        input.set(hexToBytes(OBS), 32);
        input.set(hexToBytes(BigInt(nextEpoch).toString(16).padStart(16, '0')), 52);
        const seed = window.keccak256(input);
        const aInv = COPRIMES_INV[seed[0] % 28];
        const b = seed[1] % 100;
        const out = {};
        for (const sid of sanctuaries) out[sid] = ((aInv * ((HOME_BIRDS + sid - 1 + 100 - b) % 100)) % 100) + 1;
        return out;
    }

    async function loadEnabled() {
        const ids = [...Array(MAX_SANCTUARIES).keys()].map((i) => i + 1);
        const res = await rpcBatch(ids.map((s) => call(BIRDS, SEL.enabled + pad(s))));
        const on = ids.filter((s, i) => word(res[i]) === 1n);
        if (on.length) sanctuaries = on;
    }

    async function loadNames() {
        const ids = [...Array(100).keys()].map((i) => i + 1).concat(sanctuaries.map((s) => 1000 + s));
        const res = await rpcBatch(ids.map((id) => call(BIRDS, SEL.name + pad(id))));
        ids.forEach((id, i) => { names[id] = decodeString(res[i]); });
    }
    const birdName = (bid) => names[bid] || 'Bird #' + bid;
    const sanctName = (sid) => names[1000 + sid] || 'Sanctuary #' + sid;

    // One balanceOfBatch over every enabled pair. Token id = (sanctuary - 1) * 100 + bird.
    async function readHave(addr) {
        const ids = [];
        for (const s of sanctuaries) for (let b = 1; b <= 100; b++) ids.push((s - 1) * 100 + b);
        const n = ids.length;
        const data = SEL.balances + pad(0x40) + pad(0x40 + 32 * (n + 1)) +
            pad(n) + ids.map(() => addr.slice(2).toLowerCase().padStart(64, '0')).join('') +
            pad(n) + ids.map(pad).join('');
        const r = await rpc('eth_call', [{ to: OBS, data }, 'latest']);
        if (!r || r.length < 2 + 64 * (n + 2)) throw new Error('short balanceOfBatch reply');
        const next = new Set();
        ids.forEach((id, i) => {
            if (word(r, 2 + i) > 0n) next.add((Math.floor((id - 1) / 100) + 1) + ':' + (((id - 1) % 100) + 1));
        });
        return next;
    }

    function renderGrid() {
        const g = $('grid');
        g.textContent = '';
        for (const sid of sanctuaries) {
            const row = document.createElement('div');
            row.className = 'row';
            const label = document.createElement('span');
            label.className = 'row-label';
            label.textContent = sanctName(sid);
            row.appendChild(label);
            const cells = document.createElement('span');
            cells.className = 'cells';
            for (let bid = 1; bid <= 100; bid++) {
                const c = document.createElement('i');
                const got = have.has(sid + ':' + bid);
                if (got) c.className = 'got';
                c.title = birdName(bid) + ', ' + sanctName(sid) + (got ? ' (held)' : '');
                cells.appendChild(c);
            }
            row.appendChild(cells);
            g.appendChild(row);
        }
        $('progress').textContent = account
            ? accountLabel + short(account) + ' holds ' + have.size + ' of the ' + sanctuaries.length * 100 + ' observation pairs'
            : 'Enter an address to see its progress.';
    }

    function slotList(el, layout, actionable) {
        el.textContent = '';
        const cooling = Date.now() / 1000 < coolUntil;
        for (const sid of sanctuaries) {
            const bid = layout[sid];
            const key = sid + ':' + bid;
            const li = document.createElement('li');
            const isNew = account && bid && !have.has(key);
            li.className = bid ? (isNew ? 'new' : account ? 'seen' : '') : 'empty';
            const where = document.createElement('span');
            where.className = 'where';
            where.textContent = sanctName(sid);
            const who = document.createElement('span');
            who.className = 'who';
            who.textContent = bid ? birdName(bid) : 'empty';
            li.append(where, who);
            if (account && bid) {
                const tag = document.createElement('span');
                tag.className = 'tag';
                tag.textContent = isNew ? 'needed' : 'have';
                li.appendChild(tag);
            }
            if (actionable && isNew && connected && connected === account) {
                const btn = document.createElement('button');
                btn.className = 'chip';
                btn.type = 'button';
                if (pending) {
                    btn.disabled = true;
                    btn.textContent = pending === key ? 'Sending…' : 'Observe';
                } else if (cooling) {
                    btn.disabled = true;
                    btn.textContent = 'Settling';
                } else {
                    btn.textContent = 'Observe';
                    btn.onclick = () => observe(sid, bid);
                }
                li.appendChild(btn);
            }
            el.appendChild(li);
        }
    }

    async function tick() {
        if (busy) return;
        busy = true;
        try {
            const head = await rpc('eth_getBlockByNumber', ['latest', false]);
            const n = parseInt(head.number, 16);
            if (n === lastBlock) return;
            // Every read is pinned to the head's own hash so the forecast seed and the
            // epoch come from the same block, even behind a load-balanced endpoint.
            const tag = { blockHash: head.hash };
            const at = (to, data) => ['eth_call', [{ to, data }, tag]];
            const res = await rpcBatch([
                at(BIRDS, SEL.departed),
                at(BIRDS, SEL.epoch),
                at(BIRDS, SEL.epochTs),
                at(OBS, SEL.fee),
                ...sanctuaries.map((s) => at(BIRDS, SEL.state + pad(s))),
            ]);
            lastBlock = n;
            if (word(res[0]) === 1n) {
                $('now').textContent = '';
                $('next').textContent = '';
                $('status').textContent = 'The Birds have departed. Observation is closed.';
                return;
            }
            const epoch = word(res[1]);
            coolUntil = Number(word(res[2])) + COOLDOWN_S;
            fee = word(res[3]);
            const now = {};
            sanctuaries.forEach((s, i) => {
                const r = res[4 + i];
                now[s] = word(r, 0) === 1n ? Number(word(r, 1)) : 0;
            });
            slotList($('now'), now, true);
            slotList($('next'), forecast(head.hash, epoch + 1n), false);
            $('status').textContent = 'Block ' + n.toLocaleString() + ' · epoch ' + epoch.toLocaleString() + ' · fee ' + (Number(fee) / 1e18).toFixed(5) + ' ETH';
        } catch (e) {
            $('status').textContent = 'Could not read the chain: ' + e.message;
        } finally {
            busy = false;
        }
    }

    async function setAccount(input) {
        const gen = ++selection;
        let addr = input.trim(), label = '';
        if (!/^0x[0-9a-f]{40}$/i.test(addr)) {
            if (!/\.[a-zA-Z]/.test(addr)) { $('progress').textContent = 'Enter a 0x address or an ENS name.'; return; }
            $('progress').textContent = 'Resolving ' + addr + '…';
            try { addr = await ens.resolve(addr); } catch (e) { if (gen === selection) $('progress').textContent = e.message; return; }
            label = input.trim().toLowerCase() + ' → ';
        }
        if (gen !== selection) return;
        $('progress').textContent = 'Loading…';
        let held;
        try { held = await readHave(addr.toLowerCase()); } catch (e) { if (gen === selection) $('progress').textContent = 'Could not read holdings: ' + e.message; return; }
        if (gen !== selection) return;
        account = addr.toLowerCase();
        accountLabel = label;
        have = held;
        renderGrid();
        lastBlock = 0;
        tick();
    }

    async function connect() {
        if (!window.ethereum) { $('progress').textContent = 'No browser wallet found. You can still paste an address.'; return; }
        try {
            const [a] = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (!a) throw new Error('no account shared');
            connected = a.toLowerCase();
            $('addr').value = a;
            setAccount(a);
        } catch (e) {
            $('progress').textContent = 'Wallet not connected: ' + (e.message || e);
        }
    }

    async function observe(sid, bid) {
        if (pending) return;
        pending = sid + ':' + bid;
        lastBlock = 0;
        tick();
        try {
            const chain = await window.ethereum.request({ method: 'eth_chainId' });
            if (chain !== '0x1') throw new Error('switch your wallet to Ethereum mainnet first');
            // Send the ceiling and let the contract refund the difference, so a fee update
            // between this read and inclusion does not revert the observation.
            const maxFee = (fee * 12n) / 10n;
            const data = SEL.observe + pad(sid) + pad(bid) + pad(maxFee);
            const hash = await window.ethereum.request({ method: 'eth_sendTransaction', params: [{ from: connected, to: OBS, value: '0x' + maxFee.toString(16), data }] });
            $('progress').textContent = 'Sent ' + hash.slice(0, 10) + '…. The grid refreshes in about half a minute.';
            const gen = selection;
            setTimeout(async () => {
                pending = null;
                try { const held = await readHave(account); if (gen === selection) { have = held; renderGrid(); } } catch (e) { /* keep the last grid */ }
                lastBlock = 0;
                tick();
            }, 30000);
        } catch (e) {
            pending = null;
            lastBlock = 0;
            tick();
            $('progress').textContent = 'Not sent: ' + (e.message || e);
        }
    }

    $('load').onclick = () => setAccount($('addr').value.trim());
    $('addr').addEventListener('keydown', (e) => { if (e.key === 'Enter') setAccount($('addr').value.trim()); });
    $('connect').onclick = connect;
    if (window.ethereum && window.ethereum.on) {
        window.ethereum.on('accountsChanged', (accts) => {
            connected = accts && accts[0] ? accts[0].toLowerCase() : null;
            if (connected) { $('addr').value = accts[0]; setAccount(connected); } else { lastBlock = 0; tick(); }
        });
    }

    loadEnabled().catch(() => {})
        .then(() => loadNames().catch(() => {}))
        .finally(() => { renderGrid(); tick(); setInterval(tick, 4000); });
})();

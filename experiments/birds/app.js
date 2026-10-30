// Birds planner: which bird/sanctuary pairs a wallet still needs, who is in each
// sanctuary right now, and who will be there if an observation lands in the next block.
(function () {
    const RPC = 'https://ethereum-rpc.publicnode.com';
    const OBS = '0xcf24e99e8706ff84f90e92e73ad644a1e17beb45';
    const BIRDS = '0x75de5bc35248026fabcb2382cf322bc79dfd1a8c';
    const SEL = {
        fee: '0x35662b99', epoch: '0x06c106f9', state: '0x86b0b2c0',
        name: '0x310495ab', observe: '0xca749478', departed: '0xb141d93c', balances: '0x4e1273f4',
    };
    const COPRIMES_INV = [0x35, 0x4f, 0x51, 0x57, 0x3f, 0x45, 0x47, 0x61, 0x49, 0x3b, 0x3d, 0x07, 0x53, 0x31,
        0x33, 0x11, 0x5d, 0x27, 0x29, 0x1b, 0x03, 0x1d, 0x1f, 0x25, 0x0d, 0x13, 0x15, 0x2f];
    const HOME_BIRDS = 30;
    const SANCTUARIES = [1, 2, 3, 4, 5];

    const $ = (id) => document.getElementById(id);
    const pad = (n) => BigInt(n).toString(16).padStart(64, '0');
    const hexToBytes = (h) => Uint8Array.from(h.replace(/^0x/, '').match(/../g).map((x) => parseInt(x, 16)));
    const toHex = (b) => '0x' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

    let names = {};
    let have = new Set(); // "sid:bid" pairs the wallet holds a token for
    let account = null; // address whose pairs are shown
    let connected = null; // wallet that can send
    let lastBlock = 0;
    let fee = 0n;

    async function rpc(method, params) {
        const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
        const j = await r.json();
        if (j.error) throw new Error(j.error.message);
        return j.result;
    }
    async function rpcBatch(calls) {
        const body = calls.map((c, i) => ({ jsonrpc: '2.0', id: i, method: c[0], params: c[1] }));
        const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const j = await r.json();
        return calls.map((_, i) => (j.find((x) => x.id === i) || {}).result);
    }
    const call = (to, data, tag = 'latest') => ['eth_call', [{ to, data }, tag]];

    function decodeString(hex) {
        if (!hex || hex.length < 130) return '';
        const b = hexToBytes(hex);
        const len = Number(BigInt(toHex(b.slice(32, 64))));
        return new TextDecoder().decode(b.slice(64, 64 + len));
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
        for (const sid of SANCTUARIES) out[sid] = ((aInv * ((HOME_BIRDS + sid - 1 + 100 - b) % 100)) % 100) + 1;
        return out;
    }

    async function loadNames() {
        const ids = [...Array(100).keys()].map((i) => i + 1).concat(SANCTUARIES.map((s) => 1000 + s));
        const res = await rpcBatch(ids.map((id) => call(BIRDS, SEL.name + pad(id))));
        ids.forEach((id, i) => { names[id] = decodeString(res[i]); });
    }
    const birdName = (bid) => names[bid] || 'Bird #' + bid;
    const sanctName = (sid) => names[1000 + sid] || 'Sanctuary #' + sid;

    // One balanceOfBatch over all 500 token ids. Token id = (sanctuary - 1) * 100 + bird.
    async function loadHave(addr) {
        const n = 500;
        const ids = [...Array(n).keys()].map((i) => i + 1);
        const data = SEL.balances + pad(0x40) + pad(0x40 + 32 * (n + 1)) +
            pad(n) + ids.map(() => addr.slice(2).toLowerCase().padStart(64, '0')).join('') +
            pad(n) + ids.map(pad).join('');
        const r = await rpc('eth_call', [{ to: OBS, data }, 'latest']);
        const words = r.slice(2).match(/.{64}/g);
        have = new Set();
        ids.forEach((id, i) => {
            if (BigInt('0x' + words[2 + i]) > 0n) have.add((Math.floor((id - 1) / 100) + 1) + ':' + (((id - 1) % 100) + 1));
        });
    }

    function renderGrid() {
        const g = $('grid');
        g.textContent = '';
        for (const sid of SANCTUARIES) {
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
                if (have.has(sid + ':' + bid)) c.className = 'got';
                c.title = birdName(bid) + ', ' + sanctName(sid) + (have.has(sid + ':' + bid) ? ' (held)' : '');
                cells.appendChild(c);
            }
            row.appendChild(cells);
            g.appendChild(row);
        }
        $('progress').textContent = account ? short(account) + ' holds ' + have.size + ' of the 500 observation pairs' : 'Enter an address to see its progress.';
    }
    const short = (a) => a.slice(0, 6) + '…' + a.slice(-4);

    function slotList(el, layout, actionable) {
        el.textContent = '';
        for (const sid of SANCTUARIES) {
            const bid = layout[sid];
            const li = document.createElement('li');
            const isNew = account && bid && !have.has(sid + ':' + bid);
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
                btn.textContent = 'Observe';
                btn.onclick = () => observe(sid, bid, btn);
                li.appendChild(btn);
            }
            el.appendChild(li);
        }
    }

    async function tick() {
        try {
            const head = await rpc('eth_getBlockByNumber', ['latest', false]);
            const n = parseInt(head.number, 16);
            if (n === lastBlock) return;
            lastBlock = n;
            const res = await rpcBatch([
                call(BIRDS, SEL.departed, head.number),
                call(BIRDS, SEL.epoch, head.number),
                call(OBS, SEL.fee, head.number),
                ...SANCTUARIES.map((s) => call(BIRDS, SEL.state + pad(s), head.number)),
            ]);
            if (res[0] && BigInt(res[0]) === 1n) { $('status').textContent = 'The Birds have departed. Observation is closed.'; return; }
            const epoch = BigInt(res[1]);
            fee = BigInt(res[2]);
            const now = {};
            SANCTUARIES.forEach((s, i) => {
                const r = res[3 + i];
                now[s] = r && BigInt('0x' + r.slice(2, 66)) === 1n ? Number(BigInt('0x' + r.slice(66, 130))) : 0;
            });
            slotList($('now'), now, true);
            slotList($('next'), forecast(head.hash, epoch + 1n), false);
            $('status').textContent = 'Block ' + n.toLocaleString() + ' · epoch ' + epoch.toLocaleString() + ' · fee ' + (Number(fee) / 1e18).toFixed(5) + ' ETH';
        } catch (e) {
            $('status').textContent = 'Could not read the chain: ' + e.message;
        }
    }

    async function setAccount(addr) {
        if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) { $('progress').textContent = 'That is not an Ethereum address.'; return; }
        account = addr.toLowerCase();
        $('progress').textContent = 'Loading…';
        try { await loadHave(account); } catch (e) { $('progress').textContent = 'Could not read holdings: ' + e.message; return; }
        renderGrid();
        lastBlock = 0;
        tick();
    }

    async function connect() {
        if (!window.ethereum) { $('progress').textContent = 'No browser wallet found. You can still paste an address.'; return; }
        const [a] = await window.ethereum.request({ method: 'eth_requestAccounts' });
        connected = a.toLowerCase();
        $('addr').value = a;
        setAccount(a);
    }

    async function observe(sid, bid, btn) {
        btn.disabled = true;
        btn.textContent = 'Check wallet…';
        const maxFee = (fee * 12n) / 10n;
        const data = SEL.observe + pad(sid) + pad(bid) + pad(maxFee);
        try {
            const hash = await window.ethereum.request({ method: 'eth_sendTransaction', params: [{ from: connected, to: OBS, value: '0x' + fee.toString(16), data }] });
            btn.textContent = 'Sent';
            $('progress').textContent = 'Sent ' + hash.slice(0, 10) + '…. The grid refreshes in about half a minute.';
            setTimeout(() => setAccount(account), 30000);
        } catch (e) {
            btn.disabled = false;
            btn.textContent = 'Observe';
            $('progress').textContent = 'Not sent: ' + (e.message || e);
        }
    }

    $('load').onclick = () => setAccount($('addr').value.trim());
    $('addr').addEventListener('keydown', (e) => { if (e.key === 'Enter') setAccount($('addr').value.trim()); });
    $('connect').onclick = connect;

    loadNames().catch(() => {}).finally(() => { renderGrid(); tick(); setInterval(tick, 4000); });
})();

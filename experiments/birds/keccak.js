// Keccak-256 (the pre-NIST padding Ethereum uses), BigInt lanes. Small and slow
// on purpose: the page hashes one 60-byte input per block.
(function () {
    const M = (1n << 64n) - 1n;
    const RC = [
        0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
        0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
        0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
        0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
        0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
        0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
    ];
    const ROT = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];
    const rotl = (x, n) => (n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & M);

    function permute(s) {
        for (let r = 0; r < 24; r++) {
            const C = [0, 1, 2, 3, 4].map((x) => s[x] ^ s[x + 5] ^ s[x + 10] ^ s[x + 15] ^ s[x + 20]);
            for (let x = 0; x < 5; x++) {
                const d = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1);
                for (let y = 0; y < 25; y += 5) s[y + x] ^= d;
            }
            const B = new Array(25);
            for (let x = 0; x < 5; x++)
                for (let y = 0; y < 5; y++) B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(s[x + 5 * y], ROT[x + 5 * y]);
            for (let x = 0; x < 5; x++)
                for (let y = 0; y < 25; y += 5) s[y + x] = B[y + x] ^ (~B[y + ((x + 1) % 5)] & M & B[y + ((x + 2) % 5)]);
            s[0] ^= RC[r];
        }
    }

    // bytes: Uint8Array -> Uint8Array(32)
    function keccak256(bytes) {
        const rate = 136;
        const padded = new Uint8Array(Math.ceil((bytes.length + 1) / rate) * rate);
        padded.set(bytes);
        padded[bytes.length] ^= 0x01;
        padded[padded.length - 1] ^= 0x80;
        const s = new Array(25).fill(0n);
        for (let off = 0; off < padded.length; off += rate) {
            for (let i = 0; i < rate / 8; i++) {
                let lane = 0n;
                for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(padded[off + i * 8 + b]);
                s[i] ^= lane;
            }
            permute(s);
        }
        const out = new Uint8Array(32);
        for (let i = 0; i < 4; i++) for (let b = 0; b < 8; b++) out[i * 8 + b] = Number((s[i] >> BigInt(8 * b)) & 0xffn);
        return out;
    }

    (typeof window !== 'undefined' ? window : globalThis).keccak256 = keccak256;
})();

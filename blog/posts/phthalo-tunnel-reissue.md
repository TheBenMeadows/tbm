---
title: "Phthalo Tunnel, reissued on Ethereum"
date: 2026-11-09
tags: [Art, Blockchain, Technology]
image: /blog/media/phthalo-tunnel-reissue/still.webp
image_alt: "Phthalo Tunnel: a stone tunnel mouth in a forest, in shades of Phthalocyanine Green G."
description: "On November 7, 2026 (November 8 UTC) I reissued Phthalo Tunnel on Ethereum. The original six tokens live on Abstract, which shuts down on December 15, 2026."
---

On November 7, 2026 (November 8 UTC) I reissued "Phthalo Tunnel" on Ethereum ([contract](https://etherscan.io/address/0xEf240576e22E3d197a9357BBF2588875424BB7DB)). The original six tokens live on Abstract, which shuts down on December 15, 2026. Abstract's official bridge moves ETH and ERC-20 tokens, not NFTs, so the tokens had nowhere to go. Their metadata was already gone too: the contract's `tokenURI` returns an empty string, and the image was served by the mintify.xyz launchpad, which has answered with a Cloudflare 530 error since October 19.

## The original

I released Phthalo Tunnel in February 2025 with [The Builders DAO](https://x.com/TheBuildersDao), on Mintify, as my first piece on Abstract. It was an open edition of one image, but the contract (`abstract:0x97f8003e70fc6a0701eb729fe74d916adc92eb6f`) is ERC-721, so each mint became its own token. Six were minted. When I reissued it, I held three, and three collectors held one each.

## The new contract

The reissue is an ERC-1155 with one token (id 1) and a supply of 6, built on OpenZeppelin's ERC-1155 (version 5.7.0). That matches what the piece was: an edition of one image.

The holders come from `ownerOf(1)` through `ownerOf(6)` on Abstract at block 88594846, saved as a JSON record ([on Arweave](https://arweave.net/9Tl-cLPxGktxIE-q0DNZS9KVvDA5iOTtnpprmtCKUZQ)). The constructor mints one copy per original token to the address that held it, in token order, so each of the six `TransferSingle` events lines up with one Abstract token. All four holders are plain wallets on both chains (no smart-contract wallets), so nobody had to give me a new address, and there is nothing to claim or sign.

The contract has no owner. It does not have an `owner()` function at all, so there was nothing to renounce: there is no admin, no mint function, and no way to change the metadata. The only functions that change state are the standard ERC-1155 transfers and approvals a holder uses on their own copies.

Both versions are in my catalogue: the [Ethereum reissue](https://art.thebenmeadows.com/works/eth/0xef240576e22e3d197a9357bbf2588875424bb7db/1/) and the [original six Abstract tokens](https://art.thebenmeadows.com/collections/phthalo-tunnel/).

## The image

The image shown on the token is stored on Ethereum. It is a 1100 x 1467 WebP (243,556 bytes), split across 10 data contracts: each one's code is a `0x00` byte followed by up to 24,575 bytes of image, read back with `EXTCODECOPY` (the SSTORE2 pattern). My first fully on-chain piece, "together" (2023), used the same pattern through [diid](https://x.com/0xdiid)'s efficax extension. This time the contract does it without a platform.

One limit set the size: `uri(1)` builds the metadata JSON on every call, including the base64 image, and that costs gas even though nobody pays for a read. After the Glamsterdam upgrade (live on Sepolia since October 6, not yet on mainnet), some Ethereum clients stop a read call at 16,777,216 gas (2^24): Reth ([#27633](https://github.com/paradigmxyz/reth/pull/27633)) and Nethermind do, geth ([#35845](https://github.com/ethereum/go-ethereum/pull/35845)) and Erigon ([#24520](https://github.com/erigontech/erigon/pull/24520)) do not. A contract with no owner cannot be fixed later, so I treated 2^24 as a hard ceiling. Measured on a local chain:

| still | size | gas to read `uri(1)` |
|---|---|---|
| JPEG, 1000 px | 215 KB | 12.5M |
| WebP, 1100 px, q75 | 244 KB | 14.3M |
| WebP, 1200 px, q70 | 261 KB | 15.5M |
| WebP, 1500 px, q75 | 406 KB | 25.5M |

The 1500 px version failed 5 of 8 calls on Sepolia's public RPC (publicnode), with "gas required exceeds 16777216". The 1100 px version passed 16 of 16. The metadata is returned as `data:application/json;utf8,`. Base64-encoding the whole JSON a second time cost 29.3M gas even with the 215 KB JPEG. The encoder also writes into one preallocated buffer instead of concatenating strings.

I chose the 1100 px WebP from the table above, and OpenSea shows the token's on-chain WebP.

## The master

The full-resolution file is a 5803 x 7737 JPEG (15.2 MB, SHA-256 `7c81440cd0bdb7721764ee27682a7473de3f9fcd00498206d1e7d451ffebf36a`). It is on Arweave at `ar://q_n0C9RVpO4ErRuXcJJWv-tBVMMbjNg-9iGTa0sDfok` and pinned on my own IPFS node at `ipfs://bafybeihqt64otzirnpebf36kjkizibsxquybdoi2n66jgwxrzf6x43tgwu`. Both links and the hash are in the token's metadata.

## Cost

The deploy was 11 transactions from my wallet: 10 image chunks and the token contract. It used 56,048,303 gas, 0.0104 ETH in total. The same deploy on Sepolia, which already runs Glamsterdam's higher state-creation costs (EIP-8037), took 390.3M gas, about 7 times as much.

## Checks

Claude wrote the contract, the signing page and the check script. I made the decisions and signed every transaction.

Before the mainnet deploy I ran the whole thing on a local chain and twice on Sepolia, with a script that compares the contract against the source files: holder balances against the snapshot, the decoded image against the WebP file byte for byte, the description against the approved text word for word, and the gas of every metadata read against 2^24. To make sure the script could fail, I deployed copies with planted mistakes (one lowercase letter in the description, an edition size of 7, the wrong image type), and it caught each one. The same script passed against the mainnet contract on November 7, 2026.

Before that, the contract, the signing page and the check script went through three rounds of review by seven other AI models, each asked to find a way the deploy could go wrong. They found problems. One reviewer wrote a backdoored version of the contract that the first version of the check script would have passed. Each problem was fixed before the Sepolia runs.

If you hold one and something looks wrong, message me on X ([@TheBenMeadows](https://x.com/TheBenMeadows)). The contract source is verified on [Etherscan](https://etherscan.io/address/0xEf240576e22E3d197a9357BBF2588875424BB7DB#code) and [Sourcify](https://repo.sourcify.dev/1/0xEf240576e22E3d197a9357BBF2588875424BB7DB).

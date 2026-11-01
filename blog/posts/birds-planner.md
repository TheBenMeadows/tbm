---
title: "Birds Planner"
date: 2026-10-30
tags: [Art, Technology]
related: [/experiments/birds/]
image: /blog/media/birds-planner/marfa-night.webp
image_alt: "Birds in Marfa at night: a bird on a large screen in a field, lit through fog by orange lights along the ground, people standing around it"
description: "How the sanctuary layout in Birds by Jules and Mungi is chosen, why it can be computed one block ahead, and what that means for the cost of observing all 500 bird and sanctuary pairs."
---

As of October 29, 13 of the 933 wallets that have observed [Birds](https://birds.app) by [Jules](https://x.com/nicedayJules) and [Mungi](https://x.com/mungimungimungi) have all 500 pairs, and two of them got there in exactly 500 observations, without a single duplicate. They did it in May and June, when other people were observing every few minutes. Doing the same now that the game is quiet comes down to how the contract picks the next layout.

**What an observation is**

There are 100 birds and five sanctuaries. Observing the bird currently sitting in a sanctuary costs a fee (0.00044 ETH today, around $1) and mints an ERC-1155 for that pair, so a full set is 5 x 100 = 500 tokens. Every successful observation also moves the world: the contract starts a new epoch and redraws the layout of all five sanctuaries, not just the one you observed. The game also has an end: after 1,000,000 observations every bird departs for good, and nobody can observe them after that. There had been about 20,300 by October 31.

**How the next layout is picked**

When an observation lands in block N, the Birds contract sets

`seed = keccak256(blockhash(N - 1), observations contract, epoch + 1)`

and builds the whole layout from the first two bytes of that seed. It is an affine map rather than a shuffle:

- byte 0 mod 28 picks a multiplier `a` from a fixed list of 28 values (17, 19, 21 ... 83; the 40 numbers coprime with 100, minus the small strides that would look patterned)
- byte 1 mod 100 picks an offset `b`
- slot `k` holds bird `(a⁻¹ x (k - b) mod 100) + 1`, and sanctuary `n` is slot `29 + n`

So there are only 2,800 possible layouts, and the five sanctuary birds always step by the same amount, `a⁻¹`, counting around 100. The comment in the contract says this was chosen on purpose: it is much cheaper than a full Fisher-Yates shuffle and still looks random.

The first input is what makes this predictable. `blockhash(N - 1)` is public as soon as block N - 1 lands, about 12 seconds before block N is built. The other two inputs are a constant and a counter. So for any block, the layout an observation would produce in the next block can be computed before sending anything. I checked this against the last 400 observations on-chain: each one's `ObservationRecorded` event records the bird that landed next in the sanctuary, and the formula matched all 400.

![Birds in Marfa at sunset: people gathered on a rise outside Marfa beside a metal barn, the sun breaking through a band of cloud](/blog/media/birds-planner/marfa-sunset.webp)

**What it costs to collect all 500**

Every pair has to be observed once, and the contract bounds the fee between 0.0001 and 0.01 ETH, so a full set costs at least 500 fees - about $500 at today's fee. Gas is small at current prices: about 150,000 gas per observation, a few cents at 0.1 gwei.

Without prediction, the cost depends on how busy the game is. When the five birds in front of you are all pairs you already hold, the only way to move them (short of a bird home collector or a sanctuary holder moving one by hand) is to observe one anyway, which pays a fee for a duplicate. When I measured on October 29 there had been 4 observations in the previous 19 hours, so waiting for other people to reshuffle could take a long time. I simulated 300 runs of collecting from 5 pairs to 500, drawing layouts the way the contract does: the median was about 950 observations, roughly 460 of them duplicates, so about $950.

With prediction, the duplicates go away:

1) Only observe a pair you do not hold.
2) Until the last pair, only send that observation in a block whose next layout holds another pair you still need, not counting the one this observation takes.

Rule 1 cannot buy a duplicate by accident: `observe` takes the bird you expect to see and reverts if a different one is there. Rule 2 keeps it moving: the next observation always has something to take, so the chain never stalls and every fee buys a new pair. From my 5 pairs that is 495 fees plus gas (500 from an empty wallet). The contract's 10-second cooldown between observations never gets in the way, since blocks are 12 seconds apart.

The catch is timing: the transaction has to land in the exact block you computed for, which a normal wallet cannot do. A Flashbots bundle can target one block and is dropped if it misses, so a miss costs nothing and you try again on the next block. A miss also happens when someone else's observation lands earlier in the same block, because the cooldown then rejects yours. In 300 simulated runs starting from 5 pairs, this took a median of about 935 blocks, a little over 3 hours, or about 6 hours if half the bundles miss. The formula, the on-chain check and both simulations are in [birds-forecast](https://github.com/TheBenMeadows/birds-forecast) for anyone who wants to rerun them.

On November 1, 2026 I ran a short live test from a fresh wallet: 5 observations, 5 new pairs, no duplicates, and each time the forecast matched all five sanctuaries of the layout the contract produced. 11 of the 16 bundles missed their block and cost nothing. With two relays (Flashbots and BuilderNet) 1 of 9 landed; after I added Titan and beaverbuild, 4 of 7 did, two of them in blocks Titan built - a small sample, but it suggests reaching more builders matters. The first observation used 143,063 gas and the other four 125,963 each, and the whole test cost 0.00243 ETH. These were the first 5 pairs from an empty wallet, the easy case, so it shows the method works, not how long a full set takes; the times above are still a simulation. The transactions: [1](https://etherscan.io/tx/0x5cb0b85b38e3313a8a8cfbc7ac20ceb9064cce2957b07a95b3bd1221396e8000) [2](https://etherscan.io/tx/0xd7af4d891ef5097daad15ab98aaeb9f77437687b01d307ff877deb3c4dab27a4) [3](https://etherscan.io/tx/0x5300cf3f63290cdedf2e481f22c88c8324e3c0e0059ae0d125f55af7cd7b7622) [4](https://etherscan.io/tx/0x5ef4a524ea5cbb400173e27a5e1a0ae686d30f4aec6fb4f2aef90a2244bc28cd) [5](https://etherscan.io/tx/0x4e3524c58258c1e75adac3dd58f2ffe026ddbf3173467c14857822e6b0917e01). The bot is in [birds-observer](https://github.com/TheBenMeadows/birds-observer).

Two smaller points on cost. Calling `observe` from a plain wallet uses about 150,000 gas; going through a delegated smart account uses about 390,000, which is roughly $15 versus $40 for a whole set at 0.1 gwei. And at a secondary floor of around 0.0016 ETH, more than three times the fee, buying a pair costs more than observing it, and birds.app shows only the pairs a wallet observed itself.

**The planner**

![Birds Planner on thebenmeadows.com: typing dev.bmeadows.eth fills the 5 x 100 grid with the 5 pairs that wallet holds, then the next-block forecast changes as three new blocks arrive (sped up)](/blog/media/birds-planner/planner-demo.mp4)

[Birds Planner](/experiments/birds/) shows who is in each sanctuary now, who will be there if an observation lands in the next block, and a 5 x 100 grid of the pairs any wallet holds. It takes an address or an ENS name (v1 and v2; for a name that is not plain ASCII, paste the address). It reads the chain through a public node, computes the forecast in the browser, and holds no keys - the Observe button sends from your own wallet. Because a browser wallet cannot choose its block, the forecast on the page is a guide, not a guarantee.

Before this, the tool for collecting was [Bird Watcher](https://www.bird-watcher.xyz/) by [mpeyfuss](https://x.com/mpeyfuss). You deploy your own watcher contract, fund it with ETH for fees and LINK for Chainlink Automation, and it observes the first pair you are missing whenever one shows up. It never pays for a duplicate, but it has no forecast, so when the game is quiet it waits for someone else to move the birds, and the observations are made by the watcher contract, so birds.app credits that contract rather than your wallet.

Birds Planner works the other way round. It runs nothing on your behalf, so there is nothing to deploy or fund and no LINK to keep topped up. What it adds is the next layout before it happens, which is the piece a zero-waste run needs when the game is quiet, and progress for any address or ENS name, with observations sent from your own wallet so the credit stays there.

Please submit any corrections or comments [here](https://github.com/TheBenMeadows/tbm/issues).

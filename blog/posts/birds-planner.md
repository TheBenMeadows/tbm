---
title: "Birds Planner"
date: 2026-10-30
tags: [Art, Technology]
related: [/experiments/birds/]
image: /blog/media/birds-planner/marfa-night.webp
image_alt: "Birds in Marfa at night: a bird on a large screen in a field, lit through fog by orange lights along the ground, people standing around it"
description: "How the sanctuary layout in Birds by Jules and Mungi is chosen, why it can be computed one block ahead, and what that means for the cost of observing all 500 bird and sanctuary pairs."
---

As of October 29, 13 of the 933 wallets that have observed [Birds](https://birds.app) by Jules and Mungi have all 500 pairs, and two of them got there in exactly 500 observations, without a single duplicate. They did it in May and June, when other people were observing every few minutes. Doing the same now that the game is quiet comes down to how the contract picks the next layout.

**What an observation is**

There are 100 birds and five sanctuaries. Observing the bird currently sitting in a sanctuary costs a fee (0.00044 ETH today, around $1) and mints an ERC-1155 for that pair, so a full set is 5 x 100 = 500 tokens. Every successful observation also moves the world: the contract starts a new epoch and redraws the layout of all five sanctuaries, not just the one you observed.

**How the next layout is picked**

When an observation lands in block N, the Birds contract sets

`seed = keccak256(blockhash(N - 1), observations contract, epoch + 1)`

and builds the whole layout from the first two bytes of that seed. It is an affine map rather than a shuffle:

- byte 0 mod 28 picks a multiplier `a` from a fixed list of 28 values (17, 19, 21 ... 83; the 40 numbers coprime with 100, minus the small strides that would look patterned)
- byte 1 mod 100 picks an offset `b`
- slot `k` holds bird `(a⁻¹ x (k - b) mod 100) + 1`, and sanctuary `n` is slot `29 + n`

So there are only 2,800 possible layouts, and the five sanctuary birds always step by the same amount, `a⁻¹`, counting around 100. The comment in the contract says this was chosen on purpose: it is much cheaper than a full Fisher-Yates shuffle and still looks random.

The first input is what makes this predictable. `blockhash(N - 1)` is public as soon as block N - 1 lands, about 12 seconds before block N is built. The other two inputs are a constant and a counter. So for any block, the layout an observation would produce in the next block can be computed before sending anything. I checked this against the last 400 observations on-chain: 399 of them have a following observation to compare against, and the formula predicted the bird in all 399.

**What it costs to collect all 500**

Every pair has to be observed once, and the contract bounds the fee between 0.0001 and 0.01 ETH, so a full set costs at least 500 fees - about $500 at today's fee. Gas is small at current prices: about 150,000 gas per observation, a few cents at 0.1 gwei.

Without prediction, the cost depends on how busy the game is. When the five birds in front of you are all pairs you already hold, the only way to move them (short of a Bird holder moving one by hand) is to observe one anyway, which pays a fee for a duplicate. When I measured on October 29 there had been 4 observations in the previous 19 hours, so waiting for other people to reshuffle could take a long time. I simulated 300 runs of collecting from 5 pairs to 500, drawing each layout at random: the median was about 940 observations, roughly 445 of them duplicates, so about $940.

With prediction, the duplicates go away:

1) Only observe a pair you do not hold.
2) Until the last pair, only send that observation in a block whose next layout holds another pair you still need, not counting the one this observation takes.

Rule 1 cannot buy a duplicate by accident: `observe` takes the bird you expect to see and reverts if a different one is there. Rule 2 keeps it moving: the next observation always has something to take, so the chain never stalls and every fee buys a new pair. From my 5 pairs that is 495 fees plus gas (500 from an empty wallet). The contract's 10-second cooldown between observations never gets in the way, since blocks are 12 seconds apart.

The catch is timing: the transaction has to land in the exact block you computed for, which a normal wallet cannot do. A Flashbots bundle can target one block and is dropped if it misses, so a miss costs nothing and you try again on the next block. A miss also happens when someone else's observation lands earlier in the same block, because the cooldown then rejects yours. In a 200-run simulation using the real formula and starting from 5 pairs, this took a median of about 950 blocks, a little over 3 hours, and about 6 to 8 hours if half the bundles miss. That is a simulation, not a run I have done.

Two smaller points on cost. Calling `observe` from a plain wallet uses about 150,000 gas; going through a delegated smart account uses about 390,000, which is roughly $15 versus $40 for a whole set at 0.1 gwei. And at a secondary floor of around 0.0016 ETH, more than three times the fee, buying a pair costs more than observing it, and birds.app shows only the pairs a wallet observed itself.

![Birds in Marfa at sunset: people gathered on a rise outside Marfa beside a metal barn, the sun breaking through a band of cloud](/blog/media/birds-planner/marfa-sunset.webp)

**The planner**

[Birds Planner](/experiments/birds/) shows who is in each sanctuary now, who will be there if an observation lands in the next block, and a 5 x 100 grid of the pairs any wallet holds. It takes an address or an ENS name (v1 and v2; for a name that is not plain ASCII, paste the address). It reads the chain through a public node, computes the forecast in the browser, and holds no keys - the Observe button sends from your own wallet. Because a browser wallet cannot choose its block, the forecast on the page is a guide, not a guarantee.

Before this, the tool for collecting was [Bird Watcher](https://www.bird-watcher.xyz/) by mpeyfuss. You deploy your own watcher contract, fund it with ETH for fees and LINK for Chainlink Automation, and it observes the first pair you are missing whenever one shows up. It never pays for a duplicate, but it has no forecast, so when the game is quiet it waits for someone else to move the birds, and the observations are made by the watcher contract, so birds.app credits that contract rather than your wallet.

Birds Planner works the other way round. It runs nothing on your behalf, so there is nothing to deploy or fund and no LINK to keep topped up. What it adds is the next layout before it happens, which is the piece a zero-waste run needs when the game is quiet, and progress for any address or ENS name, with observations sent from your own wallet so the credit stays there.

Corrections and measurements go to the [tbm issues](https://github.com/TheBenMeadows/tbm/issues).

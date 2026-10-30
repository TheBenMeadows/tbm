---
title: "Birds Planner"
date: 2026-10-30
tags: [Art, Technology]
related: [/experiments/birds/]
description: "How the sanctuary layout in Birds by Jules and Mungi is chosen, why it can be computed one block ahead, and what that means for the cost of observing all 500 bird and sanctuary pairs."
---

Of the 933 wallets that have observed [Birds](https://birds.app) by Jules and Mungi, 13 have observed all 500 pairs. Two of them did it in exactly 500 observations, so they never paid for a duplicate. I wanted to know how, and the answer is in the contract.

**What an observation is**

There are 100 birds and five sanctuaries. Observing the bird currently sitting in a sanctuary costs a fee (0.00044 ETH today; the artists run a bot that keeps it near $1) and mints an ERC-1155 for that pair, so a full set is 5 x 100 = 500 tokens. Every successful observation also moves the world: the contract starts a new epoch and all five sanctuaries change at once, not just the one you observed.

**How the next layout is picked**

When an observation lands in block N, the Birds contract sets

`seed = keccak256(blockhash(N - 1), observations contract, epoch + 1)`

and builds the whole layout from the first two bytes of that seed. It is not a shuffle of 100 birds in the usual sense - it is an affine map:

- byte 0 mod 28 picks a multiplier `a` from 28 values coprime with 100 (17, 19, 21 ... 83)
- byte 1 mod 100 picks an offset `b`
- slot `k` holds bird `(a⁻¹ x (k - b) mod 100) + 1`, and sanctuary `n` is slot `29 + n`

So there are only 2,800 possible layouts, and the five sanctuary birds always form an arithmetic sequence (step `a⁻¹` mod 100). The comment in the contract says this was chosen on purpose: it is much cheaper than a full Fisher-Yates shuffle and still looks random.

The part that matters is the input. `blockhash(N - 1)` is public as soon as block N - 1 is mined, which is about 12 seconds before block N exists. The other two inputs are a constant and a counter. So for any block, the layout an observation would produce in the next block can be computed before sending anything. I checked this against the last 400 observations on chain: 399 of them have a following observation to compare against, and the formula predicted the bird in all 399.

**What it costs to collect all 500**

The fee is the floor. It is set by the artists (bounded between 0.0001 and 0.01 ETH in the contract) and every pair has to be observed once, so a full set cannot cost less than 500 fees, about $500. Gas is small at current prices: about 150,000 gas per observation, a few cents at 0.1 gwei.

Without prediction, the cost depends on how busy the game is. When the five birds in front of you are all pairs you already hold, the only way to move them is to observe one anyway, which pays a fee for a duplicate. In May and June other people were observing constantly, so a patient bot could wait for them to reshuffle (that is how the two zero-waste wallets finished in 1.1 and 4.2 days). This week the game is quiet - 4 observations in about 19 hours - so waiting does not work. I simulated 300 runs of collecting from 5 pairs to 500 with random layouts: the median was about 940 observations, roughly 445 of them duplicates, so about $940.

With prediction, the duplicates go away:

1) Only observe a pair you do not hold.
2) Only send that observation in a block whose next layout also contains a pair you do not hold.

Rule 2 means the next observation always has something to take, so the chain never breaks and every fee buys a new pair. The cost is 495 fees plus gas. The catch is timing: the transaction has to land in the exact block you computed for, which a normal wallet cannot do. A Flashbots bundle can target one block and is dropped if it misses, so a miss costs nothing and you try again on the next block. In a 200-run simulation using the real formula this took a median of about 950 blocks, a little over 3 hours, and about 6 to 8 hours if half the bundles miss.

Two smaller savings are left after that. Sending from a plain wallet costs about 150,000 gas per observation; routing through a delegated smart account (so the credit lands on a main wallet without its key ever touching a server) costs about 390,000, which works out to roughly $15 versus $45 for a whole set at today's gas. And nothing is gained by buying observations on the secondary market: the floor is around 0.0016 ETH, more than three times the fee, and birds.app counts pairs you observed yourself.

**The planner**

[Birds Planner](/experiments/birds/) shows who is in each sanctuary now, who will be there if an observation lands in the next block, and a 5 x 100 grid of the pairs any wallet holds. It reads the chain through a public node, computes the forecast in the browser, and holds no keys - the Observe button sends from your own wallet. Because a browser wallet cannot choose its block, the forecast on the page is a guide, not a guarantee.

There is already a Chainlink-based bot for this, [Bird Watcher](https://www.bird-watcher.xyz/) by mpeyfuss, which observes the first eligible pair whenever one appears. It never pays for a duplicate, but it does not use the forecast either, so when the game is quiet it waits for someone else to move the birds.

Corrections and measurements go to the [tbm issues](https://github.com/TheBenMeadows/tbm/issues).

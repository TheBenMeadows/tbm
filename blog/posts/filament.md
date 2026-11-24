---
title: "filament"
date: 2026-11-24
tags: [Art, Blockchain, Technology]
related: [ursus, bitcoin-ordinals-svg-vs-svgz]
image: /blog/media/filament/filament-still.webp
image_alt: "A hand-drawn light bulb on black with gray static, its outline doubled in orange and gray and broken into horizontal bands, with an orange filament."
description: "filament is a 14,160-byte HTML inscription on Bitcoin holding one animated SVG, a layer on Droop's [bulb]. The glitch is one SVG filter, the loop lengths are prime, and its value lists come from a block hash."
---

filament is 14,160 bytes, [[inscribed::stored as a file inside a Bitcoin transaction, which makes it an inscription]] on Bitcoin on November 23, 2026 as layer 29 of [bulb]. [bulb] is an experiment Sanj [posted](https://x.com/sanjfomojis/status/2124650650827121058) the day before at [droop.house/bulb](https://droop.house/bulb): one [[sat::the smallest unit of bitcoin, a hundred-millionth of a coin. Inscriptions are numbered by the sat they sit on, so several files can share one]] that stays with Droop, and anyone can inscribe a file of up to 390 KB on top of what is already there, paying only the network fee. Layer 0 is a line drawing of a light bulb by donny clutterbuck. The transaction my layer is in is 3,750 [[vB::virtual bytes, the size Bitcoin fees are charged on. The part of a transaction an inscription sits in counts a quarter of its real size]] and paid a fee of 3,116 sats. I [posted it on X](https://x.com/TheBenMeadows/status/2125229198667071764) the next morning.

## The drawing

I did not draw a new bulb. The outline, the filament and the inside of the glass are traced from layer 0 (a 2,102 by 1,618 pixel, 1-bit PNG) into three vector paths, 9,835 bytes of path data. The outline is gray (#a3a3a3), the filament is Bitcoin orange (#f7931a), and the background is black. The filament is drawn twice, in gray and then in orange on top, along with a 13% orange tint inside the glass, so when the orange switches off the bulb reads as unlit and keeps its filament.

## The glitch

It is built the way [ursus](/blog/ursus/) (a glitched polar bear, an animated SVG on Ethereum) was: one SVG filter (2,419 bytes here) on the group that holds the drawing, with [[SMIL::the animation elements built into SVG, such as `animate` and `animateTransform`, which change an attribute over time without a script]] stepping its numbers. In order:

1) An `feTurbulence` makes fractal noise with a horizontal frequency of 0.001 and a vertical frequency between 0.004 and 0.04, so the noise comes out as wide horizontal bands.
2) An `feColorMatrix` stretches the red and green channels of that noise around the midpoint by a factor of 3. One octave of noise stays close to 0.5, and before I added this step almost nothing moved.
3) An `feComponentTransfer` with `type="discrete"` holds two 20-entry tables, one on the red channel for the drawing and one on the green channel for an orange copy of it. Each table sorts a band into no push, a partial push or a full push, left or right. ursus used `tableValues="0 1"`, so every band is pushed one way or the other. Here some entries are 0.5, which `feDisplacementMap` reads as no movement, so parts of the bulb hold still while the rest tears. Blue is fixed at 0.5, so nothing moves vertically.
4) Two `feDisplacementMap` steps use the bands. One pushes the drawing by up to 268 units and the other pushes the orange copy (the drawing recolored by an `feColorMatrix`) by up to 213, on a canvas 1,300 units wide. They read different tables, so they tear in different places.
5) A second `feTurbulence` (base frequency `0 0.4`) makes scanlines, and an arithmetic `feComposite` subtracts 30% of it from the image.
6) A third `feTurbulence` (base frequency 0.8, three octaves), turned gray by an `feColorMatrix`, is static over the whole frame, reseeded about every 45 milliseconds.

Inside the filtered group, an `animateTransform` shakes the drawing between 12 offsets of up to 21 units, and the orange layer steps through a 17-entry list of three levels (on, off and 35%).

## Prime loops

In the ursus post I worked out that its six loops (0.8, 0.4, 0.7, 0.7, 0.5 and 0.5 seconds) line up again every 28 seconds, and that prime durations would have made a large difference. filament has seven loops, at 401, 503, 701, 809, 907, 1,103 and 1,301 milliseconds. All seven are prime, so the full combination repeats only after their product, 148,880,902,685,061,927,067 milliseconds, which is about 4.7 billion years. The first four are the durations I proposed in the ursus post. The figure holds for the lists written into the file. The script described below replaces them with every new block.

## The block hash

SMIL has no random function, so each loop steps through a list of values written into the file (12 band heights, 10 noise seeds, two lists of 13 push strengths, 20 static seeds, 12 shake offsets and 17 lamp levels). I drew those lists from the hash of block 977,284, which was the latest block when I built the file.

The file also has a 1,007-byte script element in it. When the page loads, and every 30 seconds after, it asks the server it was loaded from for the latest block hash, and when the hash changes it seeds a generator from the last 32 hex characters and rewrites the lists:

```js
async function chain(){try{const h=await(await fetch("/r/blockhash")).json();
if(/^[0-9a-f]{64}$/.test(h)&&h!==block){block=h;reseed(h);document.documentElement.setAttribute("data-block",h)}}catch(e){}}
chain();setInterval(chain,30000);
```

`/r/blockhash` is one of the [[recursive endpoints::addresses an inscription is allowed to request from the server showing it, for chain data and for other inscriptions ([ord's documentation](https://docs.ordinals.com/inscriptions/recursion.html))]] of [[ord::the open-source software that indexes inscriptions and serves them]], and it returns the hash as a JSON string. The rewritten lists can push a little further than the written-in ones, up to 280 units. If the request fails, the written-in lists keep playing.

## Why it is HTML

The piece is an SVG, and I planned to inscribe it as one. As I wrote in the ursus post, a script in an SVG only runs when the SVG is opened as a document, never through an `img` tag, and droop.house shows image types (SVG included) in an `img` tag and HTML in a frame. Layer 20 on the bulb is HTML and checks `/r/blockheight` every 45 seconds, and Cyber Sea's Enigma is an HTML inscription that asks for the block height every 5 seconds.

So the inscription is the SVG, unchanged, with a 161-byte HTML prefix in front of it. That follows my [SVGZ post](/blog/bitcoin-ordinals-svg-vs-svgz/) from 2023, where the loader put the SVG into the page as inline markup. The SVG on its own is 13,999 bytes, and in an `img` tag it animates on the written-in lists without running the script.

The image below is a copy for web pages, in an ordinary `img` tag. Safari draws SVG filters slowly, so this copy keeps the tear filter only over the drawing and draws the scanlines and static as patterns, and it has no script. The [inscription itself](https://ordinals.com/content/836ca86788dad2238d346bbf7e275c2a2a44b624f198abb75189729d3a647175i0) reads the block hash.

![filament, the animated SVG](/blog/media/filament/filament.svg)

## Checking it

The inscription is [number 128,044,712](https://ordinals.com/inscription/836ca86788dad2238d346bbf7e275c2a2a44b624f198abb75189729d3a647175i0), in block 977,289. The SHA-256 of the 14,160-byte file is `bb830d2291cff9949cc24f165763c2182422180ae6a6d9d2e4001dce06cdeb3a`. Before inscribing, I loaded the file at an inscription's `/content/` address on a public ord server (static.unisat.io) and watched it request `/r/blockhash`, get the tip, and rewrite its lists. After it confirmed, I opened the inscription itself on ordinals.com in Firefox and in WebKit. Both times it requested `/r/blockhash`, got a 200, and held the hash of the latest block.

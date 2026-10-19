---
title: "ursus"
date: 2026-10-12
tags: [Art, Blockchain, Technology]
related: [art-tech-highlights]
image: /blog/media/ursus/ursus-still.webp
image_alt: "A polar bear on an ice floe under green and yellow clouds, broken into horizontal bands of red, green and blue by the glitch."
description: "ursus is an 83,914-byte animated SVG stored on Ethereum. How the glitch is built from SVG filters and SMIL, why there is no JavaScript in it, and why it repeats every 28 seconds."
---

ursus is a glitched polar bear, and the whole artwork is one 83,914-byte SVG stored on Ethereum, in token 9 of my on-chain contract. I minted it on December 14, 2025 and released it two days later as part of COMPUTERBLOOD's POLAR DERIVATIVES open call. It is primarily inspired by Bo Bartlett's "Dominion," and DTODDART's "Systems of imitation" (which I own) is what made me want to animate one. I explained it in [an X thread](https://x.com/TheBenMeadows/status/2000962340658012599) at the time; this is the longer version, with the code.

## The drawing

I generated the base image with Nano Banana Pro, edited the raster image until it had the feel I was looking for, and then redrew it as a vector image. The drawing is 338 paths and 76,816 bytes of path data. The glitch filter adds 3,241 bytes, and the last 3,857 bytes are the surrounding markup and the screen-shake animation.

## The glitch

All of the distortion is one SVG filter applied to the group that holds the drawing. In order:

1) An `feTurbulence` makes fractal noise with a horizontal frequency of 0.001 and a vertical frequency that jumps between 0.05 and 0.2, so the noise comes out as wide horizontal bands of varying height.
2) An `feComponentTransfer` with `type="discrete"` and `tableValues="0 1"` forces the red and green channels of that noise to either 0 or 1. Soft clouds of noise become hard-edged blocks.
3) Three `feColorMatrix` steps split the drawing into separate red, green and blue layers.
4) Two `feDisplacementMap` steps use the blocks to push the red layer one way and the blue layer the other way (by 30 to 180 units), while green stays put. Two screen blends put the layers back together, so the color fringes only appear where there are blocks.
5) A second `feTurbulence` with a base frequency of `0 0.4` varies only vertically, which gives horizontal scanlines, and an arithmetic `feComposite` subtracts 20% of it from the image.
6) A third `feTurbulence` (base frequency 0.8, three octaves) makes fine static, clipped to the image and blended in overlay mode.

Outside the filter, an `animateTransform` jumps the whole group between 12 offsets of up to 18 units, which is the screen shake.

Here is the first stage, as it is stored on-chain:

```xml
<feTurbulence id="turb" type="fractalNoise" baseFrequency="0.005 0.1" numOctaves="1" seed="0" result="noise">
  <animate attributeName="baseFrequency"
       values="0.001 0.1; 0.001 0.2; 0.001 0.05; 0.001 0.15; 0.001 0.08; 0.001 0.18; 0.001 0.06; 0.001 0.12; 0.001 0.19; 0.001 0.11; 0.001 0.09; 0.001 0.14"
       dur="0.8s" repeatCount="indefinite" calcMode="discrete"/>
  <animate attributeName="seed" values="1;50;12;88;33;91;4;66;21;75" dur="0.4s" repeatCount="indefinite" calcMode="discrete"/>
</feTurbulence>

<feComponentTransfer in="noise" result="blockNoise">
  <feFuncR type="discrete" tableValues="0 1"/>
  <feFuncG type="discrete" tableValues="0 1"/>
</feComponentTransfer>
```

## No JavaScript

Every moving part is SMIL, the animation elements built into SVG (`animate` and `animateTransform`). JavaScript would have made real randomness easy, but script in an SVG only runs when the SVG is opened as a document, never when it is loaded through an `img` tag. SMIL animations and filters run either way. The image below is the on-chain file in an ordinary `img` tag, and the bear still moves.

![ursus, the SVG stored on-chain, animating](/blog/media/art-tech-highlights/ursus.svg)

SMIL has no random function, so the randomness is written into the file. Each animated attribute steps through a fixed list of values (12 band heights, 10 noise seeds, 13 displacement strengths, 20 static seeds and 12 shake offsets), and `calcMode="discrete"` makes each value jump straight to the next one instead of easing between them.

Chrome [announced in 2015](https://groups.google.com/a/chromium.org/g/blink-dev/c/5o0yiO440LM) that it would deprecate SMIL and later suspended the deprecation, so the animation depends on a browser feature that one browser once planned to remove.

## 28 seconds

The loops run at 0.8, 0.4, 0.7, 0.7, 0.5 and 0.5 seconds. The technical summary in my thread (which Gemini mostly wrote) said these "create a polyrhythm that rarely aligns in the same configuration." That is wrong. Every loop starts at zero, and the shortest time in which all six loops finish a whole number of cycles is 28 seconds, so the full combination of bands, seeds, displacement, static and shake repeats exactly every 28 seconds. Within one cycle there are 2,832 distinct combinations.

The comment in the file says the band-height loop uses "prime duration to avoid looping sync." 800 milliseconds is not prime, and neither are 400, 500 or 700. Prime durations would have made a large difference: with 401, 503, 701 and 809 milliseconds (all prime) in place of the four durations, the same loops would repeat every 114,387,586,627 milliseconds, which is about 3.6 years. This is what Alex Walker called [the cicada principle](https://www.sitepoint.com/the-cicada-principle-and-why-it-matters-to-web-designers/) in 2011, for CSS backgrounds built from layers with prime widths.

## On X

X does not display SVGs (static or animated), so I made a page that shows it inside a post, and it works: [this post from December 15](https://x.com/TheBenMeadows/status/2000605450467983670) plays the animation in the timeline. [mdws.me/ursus.html](https://mdws.me/ursus.html) carries a Twitter player card, which points X at mdws.me/ursus-player.html to show in an iframe, and that page loads the SVG in an `object` tag with a JPEG preview as the fallback. Opened in a browser, ursus.html forwards to [the SVG itself](https://mdws.me/ursus.svg).

## Checking it

The contract is [0x11376B018c990a1066879275f8Be50aCEF498dAd](https://etherscan.io/address/0x11376B018c990a1066879275f8Be50aCEF498dAd). Calling `tokenURI(9)` returns a 112,027-byte JSON data URI with the name "ursus," the description "my eleventh on-chain nft," and the image as a base64 SVG. Decoded, that image has the SHA-256 `8b9479bd81341d5d13689ea072462a36d9fd2b6438b52771756a72c3eda4a061`, the same as the animated file in this post and the one on mdws.me. [onchainchecker](https://onchainchecker.xyz/fullscreen/ethereum/0x11376B018c990a1066879275f8Be50aCEF498dAd/9/image) renders it straight from the contract. I minted it with diid's efficax extension, which I have used for almost every one of my on-chain pieces.

ursus is still available. The [auction on Manifold](https://manifold.xyz/@thebenmeadows-c36dad91/id/4125286640) is open, with a starting bid of 0.042069 ETH.

If it renders differently in a viewer you use (or does not move at all), a reply on [the thread](https://x.com/TheBenMeadows/status/2000962340658012599) with the viewer's name is the quickest way to tell me.

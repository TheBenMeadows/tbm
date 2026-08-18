---
title: "essentialism: the working log"
date: 2026-07-31
updated: 2026-08-01
tags: [AI, Art, Technology]
related: [/art/essentialism/]
image: /blog/media/essentialism-the-working-log/card1-fade.webp
image_alt: "The same seed at editions 1, 15, 30 and 44, its photograph fading from 100% memory to 12%."
description: "I released a generative piece called \"essentialism\" on bootloader, objkt's new on-chain platform. The code is stored on Tezos and displayed in full on the mint page. This…"
---

I released a generative piece called "essentialism" on [bootloader](https://bootloader.art/generator/svg-js/407), objkt's new on-chain platform. The code is stored on Tezos and displayed in full on the mint page. This post is the rest of the story: where the algorithm came from, what was changed to get it on-chain, and who changed it.

## November 2022

In November 2022 I worked through Andy Haskell's tutorial [Convert images to mosaics in p5.js](https://dev.to/andyhaskell/convert-images-to-mosaics-in-p5js-2dlc), published that January, and kept going with it. His program drops columns of dots over a photograph and asks the image for a color at every step; his finished sketch is [here](https://editor.p5js.org/andyhaskell/sketches/fwaWSmAh_). I called mine "365 Days of TBM," randomized the dot size, pointed it at my own photographs, and later had it sample from several images at once. I saved nine test outputs under the name Essentialism and never released them.

The sketches are still public on my p5.js editor account, timestamps intact:

- [365 Days of TBM V1](https://editor.p5js.org/TheBenMeadows/sketches/xoJLN_mTE)
- [365 Days of TBM V3 (Dot Size, Random Img)](https://editor.p5js.org/TheBenMeadows/sketches/xWZgZaDJN)

Read the code and the seams show. Two functions are defined twice, with the earlier versions left sitting above the later ones — those are the tutorial's successive stages, stacked in one file because I never deleted a step once it was superseded. A stray `line()` call in the middle of the dot loop is left over the same way. The images are loaded into variables called `eye1, eye2, eye3`, names carried over from an abandoned sketch, even though they hold a cartoon, a glacier, and a photo from Tokyo. And the sketch titled "Dot Size" calls `noise(50, 100)` as if it took a range, which p5's `noise()` does not. It returns a constant, so the dot-size variation the title promises never actually ran.

That bug sat there for four years. It is fixed in the on-chain version, which means the piece finally does what I meant it to do in 2022.

## December 2022

One month later, ChatGPT arrived and I did what everyone did. Four sketches on my account from December 10, 2022 are labeled "ChatGPT" in the title. They read differently from anything else on the account: a comment above nearly every line restating the line, immaculate parallel naming, and a call to `moveTo()`, which is not a p5 function at all. Tidy, confident code with invented parts. My own files from that autumn are the opposite kind of mess — half-deleted stages and leftover names from other projects.

There is a fifth sketch from that week, "GPT Sketch (Human Replica)," which I want to credit properly: it is not mine and not ChatGPT's. It is [morejpeg's](https://www.youtube.com/watch?v=zesUGFM1uog) hand-written replica of a ChatGPT sketch, from his video "Competing with ChatGPT." A human racing to reproduce the machine, in December 2022. I saved a copy the same day I tweeted that I was using ChatGPT to learn p5.js.

## July 2026

This month I ported the 2022 sketch to bootloader's SVG-JS runtime with Claude. The constraint is severe and useful: the whole generator lives on-chain in under 24 KB, with no external files. No external files means no photograph, and the photograph was the sketch's whole color engine.

The answer came out of my own folders. I keep a palette file of colors sampled from my earlier on-chain works, so the port paints with those five inks instead of reading a photo. And the photographs came back in a reduced form: two of them, converted to 28×38 grids of grey, about a kilobyte each, embedded in the code. Both are photographs I minted on Ethereum in 2023. One is "Blue Tree"; the tree itself was removed after a storm that December, so the picture outlived its subject. The other is "Natural Gradient," an unedited sky whose full resolution is stored permanently on Arweave. The originals are not going anywhere. The editions are what forgets.

Each of the 44 editions samples its grid at lower strength than the one before. Edition 1 is nearly the photograph. Edition 44 is mostly grain. The memory percentage is written into every token.

![Blue Tree reduced to a 28 by 38 grid of grey, then that grid rendered at edition 1 and at edition 44.](/blog/media/essentialism-the-working-log/card2-sources.webp)

Some decisions from along the way, recorded because they are the kind of thing a log is for:

- **44 editions, not 111.** My collections have always been small, and this piece is only finished when the last edition exists.
- **I minted edition 1 myself.** It remembers the most.
- **The code once claimed ink 5 came from the sky photograph.** I could not verify it from my own records, so it came out before the mint. That ink's provenance note in my palette file reads "Mr. Blue Sky," a title that matches nothing left in my archive. The name is all that remains of wherever the color came from.
- **The description once said neither photograph would ever be published.** That was wrong twice over. "Blue Tree" has lived on Ethereum since 2023. And the sky file I believed was unpublished turned out, from its own metadata, to be the same capture as "Natural Gradient" — same second, same GPS, matching exposure to twelve digits. So the concept moved to fit the facts: the originals are permanent, and the memory is the thing that fades.
- **I checked my own 2022 sketch for copied code after the piece was already minted**, which is the wrong order to do it in. In the function that matters it is 95% Andy Haskell's tutorial by token count, and two of the helpers are his character for character. The credit above is the result. What the sketch became afterward is still mine; the structure it started from was never mine to claim.

## The odds

Every trait is decided by the seed except memory, which is decided by the edition number. The weights, as written in the code:

| trait | values |
|---|---|
| density | air 50% · field 38% · full 12% |
| inks | two 56% · three 30% · four 10% · one 4% |
| source | blue tree 87% · natural gradient 13% |
| paper | blush 28% · ivory 22% · rose 20% · fog 12% · overhead blue 10% · night 8% |
| ember | present 55% |
| memory | not random: 100% at edition 1, falling to 12% at edition 44 |

Each edition also carries its own trait line inside the artwork, in the SVG's `desc` element: density, inks, source, memory, and edition number. View source on any token and it will tell you what it is.

## What Claude wrote and what I decided

Claude did the porting work. The runtime translation, the noise function, the grid embedding, the fade math, and the texture filters are machine-written. It also found the December 2022 sketches on my account, the morejpeg attribution I had forgotten, and — when I asked it to check — the tutorial my own sketch came from.

I brought the 2022 sketch, took the photographs it remembers, sampled the inks it paints with, and made every call above. The column structure survives unchanged in the on-chain code, along with the dot spacing constant and the 2022 variable names, and that structure is Andy Haskell's. What sits on top of it is mine: the two grids, the decay across the run, the ink library, and the texture.

Everything above can be checked, which is most of why I wrote it down. Andy Haskell's tutorial is public and dated January 2022. My sketches are still on the p5.js editor with their timestamps and their bugs intact. The 2026 code is [on-chain](https://better-call.dev/mainnet/KT1CB4MYiAViCuXWBU961x7LjQXGeA8SnQwt) and printed in full on the mint page. I would rather you verify any of it than take my word for it.

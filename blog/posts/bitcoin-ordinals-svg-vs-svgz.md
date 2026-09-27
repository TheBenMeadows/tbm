---
title: "Bitcoin Ordinals: SVG vs SVGZ"
subtitle: "Adapted from my X thread of October 6, 2023"
date: 2023-10-06
updated: 2026-09-27
tags: [Blockchain, Technology, Art]
related: [art-tech-highlights]
image: /blog/media/svgz-ordinals/test-inscription.webp
image_alt: "A red ski mask in black line work on a black background, the SVG from the October 2023 test inscription."
description: "A 106,852-byte SVG inscribed on Bitcoin as a 32,319-byte SVGZ plus a 928-byte HTML loader: 69% less block space, and the change that got the loader past the Content Security Policy on ord.io and Gamma."
---

The SVG in the image above is 106,852 bytes. Gzipped, it is 32,319 bytes, and that is what I inscribed on Bitcoin in October 2023, along with a 928-byte HTML inscription that decompresses it and displays it. The two together take 33,247 bytes of block space, 69% less than the SVG alone would have. I posted [the idea](https://x.com/TheBenMeadows/status/1708990258631917955) on X on October 2 and [the working result](https://x.com/TheBenMeadows/status/1710390295899324609) as a thread on October 6; this is the write-up with the code in it.

An SVGZ is an SVG compressed with gzip. Vector art is text (mostly path coordinates), and text compresses well; 50-80% smaller is the range I have seen on SVGs. The problem is how the browser learns that it has been sent compressed data. A web server serving an .svgz file adds a `Content-Encoding: gzip` header and the browser decompresses before it renders. An inscription carries a content type and nothing else, so ordinals.com served my first SVGZ ([inscription 34963011](https://ordinals.com/inscription/34963011), October 1) as `image/svg+xml` with the gzip bytes as the body. The browser tries to parse compressed binary as XML and shows an error where the image should be.

So the SVGZ needs a second inscription that fetches it, decompresses it in JavaScript, and puts the result on the page. Recursion makes that cheap, since an inscription can load any other inscription from `/content/<id>`. The decompressor was already on-chain: boppleton had inscribed pako 2.1.0, a JavaScript port of zlib, as an ES module in August 2023 ([47,663 bytes](https://ordinals.com/inscription/fba6f95fb1152db43304a27dce8cb8c65509eba6ab0b6958cedeb33e5f443077i0)), so the loader imports that instead of carrying its own copy.

The first loader, [inscription 35084623](https://ordinals.com/inscription/35084623), displayed on ordinals.com and showed nothing on ord.io or Gamma. It fetched pako as text, turned it into a `data:` URL, imported the module from that URL, and handed the decompressed SVG to an `<embed>` as a second `data:` URL. ordinals.com's Content Security Policy allows `data:` URLs. The policies on those two sites were stricter and did not.

After several rewrites, the version that displayed on every Ordinals site and wallet I tested is [inscription 35118062](https://ordinals.com/inscription/35118062):

```html
<html>

<body style="margin:0px;">
    <div id="svg-container"></div>
    <script>
        async function displaySvg() {
            const svgzUrl = '/content/62a77ef2f8fa7caaa237c36cd7404d1a46918c074d79bb73228108d7e0968b11i0';
            const response = await fetch(svgzUrl);
            const compressedData = await response.arrayBuffer();

            const module = await import('/content/fba6f95fb1152db43304a27dce8cb8c65509eba6ab0b6958cedeb33e5f443077i0');
            const decompressedData = module.inflate(new Uint8Array(compressedData), {to: 'string'});

            const container = document.getElementById('svg-container');
            container.innerHTML = decompressedData;

            const svgElement = container.querySelector('svg');
            svgElement.setAttribute('width', '100%');
            svgElement.setAttribute('height', '100%');
        }

        displaySvg();
    </script>
</body>

</html>
```

Everything it loads comes from `/content/` on the same origin, and the SVG goes into the page as inline markup instead of through a URL. The two `/content/` IDs are the only parts specific to this piece. The art is part of a collab between Twickert and me, and our collab piece released on November 1, 2023 was the first built on this method.

Seven weeks after the thread, [ord 0.12.0](https://github.com/ordinals/ord/releases/tag/0.12.0) (November 24, 2023) added compression to the protocol. `ord wallet inscribe --compress` compresses the content with brotli, keeps the result only if it is smaller, and records `br` in the inscription's `content_encoding` field. ord's server then sends that as a `Content-Encoding: br` header, and the browser decompresses it with no loader inscription. On this SVG, brotli at its highest setting comes to 28,316 bytes, against 33,247 for the SVGZ and loader together. [ord 0.13.0](https://github.com/ordinals/ord/releases/tag/0.13.0) added a server flag that decompresses brotli before serving it, for clients that cannot handle the header.

The inscriptions, the loader, and pako are all readable at the links above.

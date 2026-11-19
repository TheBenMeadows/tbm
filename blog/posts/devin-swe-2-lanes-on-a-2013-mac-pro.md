---
title: "Devin SWE-2 lanes on a 2013 Mac Pro"
date: 2026-11-19
tags: [AI, Technology]
description: "A 2013 Mac Pro running Debian runs Devin SWE-2 sessions on open puzzles in Docker under gVisor, with a judge checking every result. The setup, what broke and the results."
---

In October I bought a 2013 Mac Pro (6-core Xeon E5-1650 v2, 64 GB of ECC memory, two FirePro D500s). At the end of the month I wiped it and installed Debian 13.7, and it now runs as a headless server.

On November 3 I started running Devin on it. I'm using the Devin CLI in headless mode (SWE-2 Max model) on open puzzles where a computer can check the score. I call each puzzle a lane: Devin works on it one session after another, and a few lanes run side by side.

**The setup**

Each lane is a Docker container with 2 CPUs and 8 GB of memory. The image has Python 3.13 (numpy, scipy, mpmath, numba, OR-Tools, cvxpy) plus gcc and PARI. Devin can write to a work folder and read an inputs folder, and it gets a brief for that puzzle and a copy of the CLI login.

One gotcha: I first mounted the Devin CLI folder read-only. The CLI panicked, because it writes its logs there.

When a session ends, a judge runs on the host (outside the container) and prints one score. Progress only counts if the judge says the score got better. Nothing gets submitted unless the judge passes, and the sessions themselves never submit, post or push anything. For two of the Paradigm puzzles (packing and VLIW), a poller on another machine checks the result a second time and submits it only if it beats our live score. Before I trusted any judge, I planted deliberate faults to make sure it caught them.

A supervisor script runs from cron every 5 minutes. It keeps up to 4 lanes going from a queue and starts them 15 minutes apart. It also waits if it sees 2 or more rate limits in a 30 minute window. A lane stops itself after 3 sessions in a row with no checked progress.

**gVisor**

Inside each container, Devin runs with its permission mode set to dangerous (the container is the boundary). On November 5, after some news about Linux privilege-escalation bugs, I moved every lane and every judge from Docker's default runtime to gVisor (runsc). Registering it only took a reload of Docker, so the containers that were already running kept going.

I measured the cost on one judge: 160 seconds under runsc vs 143 seconds under the default runtime (about 12% slower). The Devin CLI worked inside gVisor with no changes.

**What broke**

1) The free-model rate limit. The first night, I had 6 lanes going in parallel. Devin started answering some sessions with "Reached free model rate limit ... reset in 30 seconds" and those sessions ended mid-run. My runner counted each one as dry, so the stop rule shut down 5 lanes in one go. Now a session that hits the limit waits 90-210 seconds and tries again (and it doesn't count as dry). Repeated rate limits back off longer each time (3 minutes, then 6, then 12, up to 60). I also cut the supervisor from 4 lanes to 3 and gave each one 4 CPUs.

2) My supervisor also got stuck, twice. The first time, the lane it started inherited the supervisor's lock file, so every tick after that saw the lock and quit (and the next lane in the queue never started). The second time, a background subshell was hanging on to the lock.

3) A score that didn't survive the server. The QEC lane (a decoder for quantum error correction) got its local score down to 2912. Paradigm's validator rejected it, though: the decoder timed out (the limit is 2.5 seconds) because it trained on up to 2.2 million samples every time it was built. The fix was to change the brief so it trains offline and embeds the tables. The next version had 92 KB of tables and decoded in about 50 ms.

**Results**

These are the public ones (there were also a few unsolved cipher puzzles in the queue):

1) Paradigm packing: the first session improved our score from 2.9485289324787587 to 2.9485283511515643 (exact-area optimization, a cap sweep and a lattice descent). Once the poller was running, it made three more submissions by itself, and the lane finished at 2.948527364112592.

2) Paradigm VLIW: 971 to 969 cycles. Devin retuned a gather table and changed a setting called LOW_WATER from 8 to 4. It didn't touch the simulator or the tests (I re-ran the official tests myself). After that the lane had 3 dry sessions and stopped.

3) Paradigm QEC: our first entry, 2854 errors per million.

The GPUs are not used. The two D500s share one heat core with the CPU. Under Linux, the fan ignores CPU temperature unless you tell it otherwise (I wrote a small fan curve script for that). I didn't want to risk the board, so the GPUs stay off.

Disclosure: I am a Devin ambassador. These are my own notes and numbers, not Cognition's.

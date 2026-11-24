---
title: "Devin SWE-2 lanes on a 2013 Mac Pro"
date: 2026-11-19
tags: [AI, Technology]
description: "A 2013 Mac Pro running Debian runs Devin SWE-2 sessions on open puzzles in Docker under gVisor, with a judge checking every result."
---

In October I bought a 2013 Mac Pro (6-core Xeon E5-1650 v2, 64 GB of ECC memory, two FirePro D500s). At the end of the month I wiped it and installed Debian 13.7, and it now runs as a headless server.

On November 3 I started running Devin on it. I'm using the Devin CLI in headless mode (the free SWE-2 model, at its max setting) on open puzzles where a computer can check the score. I call each puzzle a lane: Devin works on it one session after another, and a few lanes run side by side.

**The setup**

Each lane is a Docker container with 4 CPUs and 8 GB of memory (2 CPUs at first). The image has Python 3.13 (numpy, scipy, mpmath, numba, OR-Tools, cvxpy) plus gcc and PARI. Devin can write to a work folder and read an inputs folder, and it gets a brief for that puzzle and a copy of the CLI login.

I first mounted the Devin CLI folder read-only, and the CLI panicked because it writes its logs there.

When a session ends, a judge script on the host scores the work and prints one score (when it has to run the lane's code, it does that in a fresh container of its own). Progress only counts if the judge says the score got better. Nothing gets submitted unless the judge passes, and the sessions themselves never submit, post or push anything. For two of the Paradigm puzzles (packing and VLIW), a poller on another machine checks the result a second time and submits it only if it beats my live score. Before I trusted any judge, I planted deliberate faults to make sure it caught them.

A supervisor script runs from cron every 5 minutes. It keeps up to 3 lanes going from a queue and starts them at least 15 minutes apart. It also starts nothing new while the lanes have logged 2 or more rate limits in the last 30 minutes. A lane stops itself after 3 sessions in a row with no checked progress (I call those dry).

**gVisor**

Inside each container, Devin runs with its permission mode set to dangerous (the container is the boundary). On November 5, after some news about Linux privilege-escalation bugs, I moved every lane, and every judge still in use, from Docker's default runtime to gVisor (runsc). Registering it only took a reload of Docker (not a restart), so nothing else running on the box went down. The three lanes running at the time stopped after their current session and came back up under runsc.

I measured the cost on one judge: 160 seconds under runsc vs 143 seconds under the default runtime (about 12% slower). The Devin CLI worked inside gVisor with no changes.

**What broke**

1) The free-model rate limit. The first night, before the supervisor existed, I had started 6 lanes by hand. Devin started answering some sessions with "Reached free model rate limit ... reset in 30 seconds" and those sessions ended mid-run. My runner counted each one as dry, so the stop rule shut down 5 lanes in one go. Now a session that hits the limit doesn't count as dry. The runner waits 3 minutes and tries again, and doubles the wait each time it hits the limit in a row (6, then 12, up to 60 minutes).

2) My supervisor also got stuck, twice. The first time, the lane it started inherited the open file descriptor the supervisor holds its flock on, so the lock stayed held and every tick after that quit (I now close that descriptor when starting a lane). The second time, a background subshell kept the same descriptor open while it waited on the lane (now I background the command itself).

3) A score that didn't survive the server. The QEC lane (a decoder for quantum error correction) got its local score down to 2912 errors per million. Paradigm's free validate check rejected it, so I never submitted it: the decoder timed out (the limit is 2.5 seconds) because it trained on up to 2.2 million samples every time it was built. The fix was to change the brief so it trains offline and embeds the tables. The next version had 92 KB of tables, decoded in about 50 ms and passed the validator.

**Results**

These are the public ones (lower is better on all three; there were also a few unsolved cipher puzzles in the queue):

1) Paradigm packing: the first session improved my score from 2.9485289324787587 to 2.9485283511515643 (exact-area optimization, a cap sweep and a lattice descent). Once the poller was running, it made three more submissions by itself, and the lane finished at 2.948527364112592.

2) Paradigm VLIW: 971 to 969 cycles. Devin retuned a gather table and changed a setting called LOW_WATER from 8 to 4. It didn't touch the simulator or the tests (I re-ran the official tests myself). After that the lane had 3 dry sessions and stopped.

3) Paradigm QEC: my first entry, 2854 errors per million on Paradigm's server (the same decoder scored 2910 locally).

The two D500s share one thermal core with the CPU. Under Linux, the fan ignores CPU temperature unless you tell it otherwise (I wrote a small fan curve script for that). I didn't want to risk the board, so the GPUs stay off.

#!/bin/zsh
# Upgrade pending OpenTimestamps proofs into real Bitcoin attestations.
#
# `ots stamp` returns immediately with a calendar server's PROMISE to include
# the digest in a future block. That promise only becomes a Bitcoin attestation
# once a block confirms and the calendar publishes the merkle path to it, and
# collecting that path requires someone to run `ots upgrade` afterwards. Until
# then the proof rests on the calendar still holding the data -- if it loses
# it, the proof is worthless.
#
# Nobody ran it between 2026-08-03 and 2026-08-13, so six of eleven proofs were
# still calendar-only while /tech/ and /mirrors/ said "anchored in Bitcoin"
# without qualification. The five complete ones came from a single manual pass.
#
# Idempotent by design: a complete proof is left untouched, so this is safe to
# run on a timer and safe to run twice. An upgrade that cannot complete yet
# (block not mined, calendar unreachable) is not an error -- it just means try
# again later, which is exactly what the schedule is for.
#
# Exit 0 when every proof is complete or legitimately still pending; exit 1
# only if the client is missing or the commitments directory is not there.
set -uo pipefail

OTS_BIN="${OTS_BIN:-$HOME/.config/openagents/ots-venv/bin/ots}"
COMMITMENTS="${COMMITMENTS:-commitments}"

[ -x "$OTS_BIN" ] || { print -r -- "upgrade-timestamps: no ots client at $OTS_BIN" >&2; exit 1; }
[ -d "$COMMITMENTS" ] || { print -r -- "upgrade-timestamps: no $COMMITMENTS directory" >&2; exit 1; }

# A proof is complete when it carries at least one Bitcoin block attestation.
# Pending-only proofs carry just PendingAttestation entries from the calendars.
complete() {
    [ "$("$OTS_BIN" info "$1" 2>/dev/null | grep -c 'BitcoinBlockHeaderAttestation')" -gt 0 ]
}

ALREADY=0 UPGRADED=0 STILL=0
for F in "$COMMITMENTS"/*.ots(N); do
    if complete "$F"; then
        ALREADY=$((ALREADY + 1))
        continue
    fi
    "$OTS_BIN" upgrade "$F" >/dev/null 2>&1
    if complete "$F"; then
        UPGRADED=$((UPGRADED + 1))
        # ots writes a .bak beside anything it rewrites. The upgraded proof is
        # a superset of the pending one, so the backup is redundant the moment
        # the upgrade lands -- and leaving it turns "one proof per release,
        # named for the hash it attests" into a directory of near-duplicates.
        rm -f "$F.bak"
        print -r -- "upgraded: ${F:t}"
    else
        STILL=$((STILL + 1))
    fi
done

TOTAL=$((ALREADY + UPGRADED + STILL))
print -r -- "timestamps: $((ALREADY + UPGRADED))/$TOTAL anchored in Bitcoin (${UPGRADED} upgraded this run, ${STILL} still pending)"

# Pending proofs are normal for anything stamped in the last few hours, so they
# are reported rather than treated as a failure.
exit 0

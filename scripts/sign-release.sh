#!/bin/bash
# Sign a built release: hash the manifest, publish that hash as a signed Nostr
# event, and anchor the same hash in Bitcoin with OpenTimestamps.
#
# What this buys: anyone reading the site on any mirror can confirm the bytes
# are the ones that were published, that the publisher holds Ben's Nostr key,
# and roughly when the release existed. Modelled on the Orrery pre-commitment
# pipeline, but the purpose is provenance rather than pre-commitment.
#
# The key is read from NOSTR_SECRET_KEY. It must never be passed as an argument,
# because arguments end up in shell history, process listings and transcripts.
#
# Usage:  NOSTR_SECRET_KEY=nsec1... scripts/sign-release.sh [dist-dir]
#         DRY_RUN=1 scripts/sign-release.sh     # hash and stamp, publish nothing

set -euo pipefail

DIST="${1:-dist}"
MANIFEST="$DIST/manifest.json"
OTS_BIN="${OTS_BIN:-$HOME/.config/openagents/ots-venv/bin/ots}"
COMMITMENTS="commitments"
# Keep this list in step with .nsite/config.json and .well-known/nostr.json.
# It drifted once: the 2026.08.12 release signature still went to nos.lol and
# damus.io after both had been dropped everywhere else, because this default
# was a fourth, forgotten copy of the relay list.
RELAYS="${NOSTR_RELAYS:-wss://relay2.mdws.me wss://relay.mdws.me wss://relay.primal.net wss://relay.snort.social}"

if [ ! -f "$MANIFEST" ]; then
    echo "sign-release: $MANIFEST not found. Run the build first." >&2
    exit 1
fi

# Hash the EXACT bytes of the manifest as written. Do not reformat, re-encode or
# strip whitespace between hashing and publishing: normalising the bytes after
# committing to a hash is the specific bug that broke Orrery's audit posts.
HASH=$(shasum -a 256 "$MANIFEST" | cut -d' ' -f1)
COMMIT=$(python3 -c "import json;print(json.load(open('$MANIFEST'))['commit'])")
TREE=$(python3 -c "import json;print(json.load(open('$MANIFEST'))['treeSha256'])")

echo "manifest sha256: $HASH"
echo "tree sha256:     $TREE"
echo "commit:          $COMMIT"

# --- Bitcoin anchor (non-fatal: a Nostr signature still stands without it) ---
OTS_PATH=""
if [ -x "$OTS_BIN" ]; then
    mkdir -p "$COMMITMENTS"
    TMP=$(mktemp -t tbm_ots)
    cp "$MANIFEST" "$TMP"
    # Refuse to stamp anything that does not hash to the value we are publishing.
    ACTUAL=$(shasum -a 256 "$TMP" | cut -d' ' -f1)
    if [ "$ACTUAL" != "$HASH" ]; then
        echo "sign-release: copy hashed $ACTUAL, expected $HASH -- refusing" >&2
        rm -f "$TMP"
        exit 1
    fi
    if "$OTS_BIN" stamp "$TMP" >/dev/null 2>&1 && [ -s "$TMP.ots" ]; then
        mv -f "$TMP.ots" "$COMMITMENTS/$HASH.ots"
        OTS_PATH="$COMMITMENTS/$HASH.ots"
        echo "ots proof:       $OTS_PATH (pending until the next Bitcoin block confirms)"
    else
        echo "sign-release: OTS stamp failed (calendars unreachable?), continuing" >&2
    fi
    rm -f "$TMP" "$TMP.ots"
else
    echo "sign-release: no ots client at $OTS_BIN, skipping the Bitcoin anchor" >&2
fi

# --- Nostr signature ---
# Kind 30078 is a parameterised replaceable event, so each release replaces the
# previous one under the same d-tag rather than accumulating notes.
CONTENT=$(python3 - "$HASH" "$TREE" "$COMMIT" "$OTS_PATH" <<'PY'
import json, sys
h, tree, commit, ots = sys.argv[1:5]
print(json.dumps({
    "site": "thebenmeadows.com",
    "manifestSha256": h,
    "treeSha256": tree,
    "commit": commit,
    "otsProof": (f"commitments/{h}.ots" if ots else None),
}, separators=(",", ":")))
PY
)

if [ "${DRY_RUN:-0}" = "1" ]; then
    echo "--- DRY RUN, publishing nothing ---"
    echo "$CONTENT"
    exit 0
fi

if [ -z "${NOSTR_SECRET_KEY:-}" ]; then
    echo "sign-release: NOSTR_SECRET_KEY is not set. Export it; never pass it as an argument." >&2
    exit 1
fi

# nak reads the key from NOSTR_SECRET_KEY itself (`--sec value ... [$NOSTR_SECRET_KEY]`
# in its own help), so passing --sec here only put the release key into argv --
# visible to every same-uid process -- in a script whose header says never to do
# that. The check above already guarantees the variable is set.
# shellcheck disable=SC2086
# Keep stdout and stderr apart, and read nak's own status rather than tail's.
# Folding them together and piping to tail discarded the exit code, so a run
# where every relay rejected the event printed the rejections and still exited
# 0 -- "it ran" reported as "the signature published".
EVENT_ERR=$(mktemp)
trap 'rm -f "$EVENT_ERR"' EXIT
set +o pipefail
EVENT=$(nak event \
    -c "$CONTENT" \
    -k 30078 \
    -d "thebenmeadows.com" \
    -t "t=site-release" \
    $RELAYS 2>"$EVENT_ERR")
NAK_STATUS=$?
set -o pipefail

if [ "$NAK_STATUS" -ne 0 ]; then
    echo "sign-release: nak exited $NAK_STATUS; the release event did not publish." >&2
    tail -5 "$EVENT_ERR" >&2
    exit 1
fi

if [ -z "$EVENT" ]; then
    echo "sign-release: nak produced no event; the release event did not publish." >&2
    tail -5 "$EVENT_ERR" >&2
    exit 1
fi

tail -5 "$EVENT_ERR" >&2
echo "$EVENT"

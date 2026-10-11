#!/bin/bash
# =============================================================================
# tools/perf/bench.sh — measure the arcade's sky in headless Chrome.
#
#   tools/perf/bench.sh [options] <label>
#
#   -s DIR   arcade tree to measure        (default: the one this script is in)
#   -q TIER  lighter | full                (default: lighter — the budgets in
#                                           PERFORMANCE.md are written against it)
#   -v LIST  views, comma-separated        (default: all — title, every island,
#                                           overview; see probe.js)
#   -x       also save a PNG of every view (for "does it still look the same")
#   -p QS    extra query string, e.g. -p scale=0.5
#   -b DIR   directory with babylon.js + loaders.js (default: ../neonfox/vendor,
#            the same 8.56.2 index.html pins; nothing is vendored in this repo)
#   -o DIR   output root                   (default: $TMPDIR/arcade-perf)
#   -t SEC   give up after                 (default: 240)
#
# Prints one line per view; everything lands in <out>/<label>/ (stderr.txt,
# perf.jsonl, <view>.png). See README.md for what the columns mean.
#
# WHY THE LOCK. Two headless Chromes at once on SwiftShader hang this Mac and
# halve each other's numbers anyway, and during a push several agents bench
# at the same time. So one Chrome at a time, through a mkdir lock (atomic on
# every filesystem) that records its owner's pid: a lock whose owner has died
# is taken over rather than waited on for ever. PERF_LOCK overrides the path,
# so a session can share a lock with an older harness. PERF_PROBE swaps in a
# different probe script for a one-off experiment, CHROME a different binary.
#
# WHY POLL-AND-KILL. Headless Chrome with --screenshot does not exit when the
# page is done — the probe's hold-open image makes sure of it — so this
# watches stderr for PERF DONE and kills exactly the Chrome it started, found
# by its own fresh --user-data-dir. A fresh profile every run, because a
# reused one quietly serves yesterday's cached files.
# =============================================================================
set -u
here=$(cd "$(dirname "$0")" && pwd)
src=$(cd "$here/../.." && pwd)
tier=lighter views= shots=0 extra= babylon= outroot=${TMPDIR:-/tmp}/arcade-perf timeout=240
while getopts "s:q:v:xp:b:o:t:" opt; do
  case $opt in
    s) src=$(cd "$OPTARG" && pwd) || exit 1 ;;
    q) tier=$OPTARG ;;
    v) views=$OPTARG ;;
    x) shots=1 ;;
    p) extra=$OPTARG ;;
    b) babylon=$OPTARG ;;
    o) outroot=$OPTARG ;;
    t) timeout=$OPTARG ;;
    *) sed -n '4,20p' "$0"; exit 2 ;;
  esac
done
shift $((OPTIND - 1))
label=${1:?usage: bench.sh [options] <label>}
hub=$(cd "$here/../../.." && pwd)
babylon=${babylon:-$hub/neonfox/vendor}
chrome=${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
lock=${PERF_LOCK:-${TMPDIR:-/tmp}/arcade-perf-chrome.lock}
out=$outroot/$label
mkdir -p "$out"

# --- the lock ---------------------------------------------------------------
waited=0
until mkdir "$lock" 2>/dev/null; do
  owner=$(cat "$lock/pid" 2>/dev/null)
  if [ -n "$owner" ] && ! kill -0 "$owner" 2>/dev/null; then
    echo "bench: taking over a lock left by dead pid $owner" >&2
    rm -rf "$lock"; continue
  fi
  # No pid inside: an older harness that does not write one. Give it a run's
  # worth of time, then assume it died holding the lock.
  if [ -z "$owner" ] && [ -n "$(find "$lock" -maxdepth 0 -mmin +15 2>/dev/null)" ]; then
    echo "bench: taking over a pid-less lock older than 15 minutes" >&2
    rm -rf "$lock"; continue
  fi
  [ $((waited % 30)) -eq 0 ] && echo "bench: waiting for another bench to finish ($lock)" >&2
  sleep 2; waited=$((waited + 2))
done
echo $$ > "$lock/pid"
prof=$(mktemp -d "${TMPDIR:-/tmp}/arcade-perf-profile.XXXXXX")
cleanup() { pkill -f "user-data-dir=$prof" 2>/dev/null; sleep 1; rm -rf "$prof" "$lock"; }
trap cleanup EXIT INT TERM

# --- stage, run, report -----------------------------------------------------
node "$here/bench.mjs" stage "$src" "$hub" "$out/tree" "$babylon" "${PERF_PROBE:-$here/probe.js}" || exit 1
qs="q=$tier&perfshots=$shots"
case "&$extra" in *"&scale="*) ;; *) qs="$qs&scale=1" ;; esac
[ -n "$views" ] && qs="$qs&perfviews=$views"
[ -n "$extra" ] && qs="$qs&$extra"
rm -f "$out"/*.png "$out/stderr.txt" "$out/perf.jsonl"

# scale=1 (unless -p sets its own) pins the backbuffer, and so switches off
# the resolution governor, so that runs are comparable with each other.
"$chrome" --headless=new --user-data-dir="$prof" --no-first-run --no-default-browser-check \
  --allow-file-access-from-files --enable-unsafe-swiftshader --use-angle=swiftshader \
  --window-size=960,600 --hide-scrollbars --autoplay-policy=no-user-gesture-required \
  --enable-logging=stderr --v=0 --timeout=$((timeout * 1000)) --screenshot="$prof/ignored.png" \
  "file://$out/tree/arcade/index.html?$qs" > /dev/null 2> "$out/stderr.txt" &

for _ in $(seq 1 $((timeout + 20))); do
  sleep 1
  grep -q '"PERF DONE"' "$out/stderr.txt" 2>/dev/null && break
done
pkill -f "user-data-dir=$prof" 2>/dev/null
sleep 1
node "$here/bench.mjs" report "$out"

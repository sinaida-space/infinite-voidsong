#!/usr/bin/env bash
# Turns sounds-raw/<id>.wav|mp3 into looped Opus files in public/audio/<id>.opus
# and rewrites public/audio/manifest.json.
#
# Pipeline per file: trim 60 s window (start from scripts/sounds-meta.json),
# high-pass 60 Hz, loudnorm -20 LUFS, 4 s equal-power crossfade of tail into head
# (output is 56 s), Opus 72 kbps stereo.
# Seam layout: out = crossfade(tail 56-60 s, head 0-4 s) + middle 4-56 s,
# so the last sample continues into the first one when the file loops.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW="$ROOT/sounds-raw"
OUT="$ROOT/public/audio"
META="$ROOT/scripts/sounds-meta.json"
FFMPEG="${FFMPEG:-/opt/homebrew/bin/ffmpeg}"
FFPROBE="${FFPROBE:-/opt/homebrew/bin/ffprobe}"

WINDOW=60   # seconds taken from the source
XFADE=4     # seconds of loop crossfade
BITRATE=72k

mkdir -p "$OUT"
rm -f "$OUT"/*.opus

ids=$(node -e "for (const f of require('$META').files) console.log(f.id)")

for id in $ids; do
  src=""
  for ext in wav mp3; do
    [ -f "$RAW/$id.$ext" ] && src="$RAW/$id.$ext" && break
  done
  [ -n "$src" ] || { echo "missing raw file for $id" >&2; exit 1; }
  start=$(node -e "console.log(require('$META').files.find(f=>f.id==='$id').startSec)")
  tail_start=$((WINDOW - XFADE))

  "$FFMPEG" -v error -y -i "$src" -filter_complex "
    [0:a]atrim=start=${start}:duration=${WINDOW},asetpts=PTS-STARTPTS,
      highpass=f=60,loudnorm=I=-20:TP=-2:LRA=11,aresample=48000,asplit=3[a][b][c];
    [a]atrim=0:${XFADE},asetpts=PTS-STARTPTS[head];
    [b]atrim=${tail_start}:${WINDOW},asetpts=PTS-STARTPTS[tail];
    [c]atrim=${XFADE}:${tail_start},asetpts=PTS-STARTPTS[mid];
    [tail][head]acrossfade=d=${XFADE}:c1=qsin:c2=qsin[x];
    [x][mid]concat=n=2:v=0:a=1[o]" \
    -map "[o]" -c:a libopus -b:a "$BITRATE" -ac 2 "$OUT/$id.opus"
  echo "built $id.opus"
done

# Manifest from meta + ffprobe
FFPROBE="$FFPROBE" OUT="$OUT" META="$META" BITRATE="$BITRATE" WINDOW="$WINDOW" XFADE="$XFADE" node -e '
const { execFileSync } = require("child_process");
const fs = require("fs");
const meta = require(process.env.META);
const files = meta.files.map(f => {
  const file = f.id + ".opus";
  const p = process.env.OUT + "/" + file;
  const dur = parseFloat(execFileSync(process.env.FFPROBE, ["-v","error","-show_entries","format=duration","-of","csv=p=0",p]).toString());
  return {
    id: f.id, file, durationSec: Math.round(dur * 100) / 100, bytes: fs.statSync(p).size,
    title: f.title, author: f.author, sourceUrl: f.sourceUrl,
    license: meta.license, licenseLine: f.licenseLine, licenseUrl: meta.licenseUrl,
    processing: [
      `trim ${process.env.WINDOW} s from ${f.startSec} s`, "highpass 60 Hz", "loudnorm -20 LUFS",
      `crossfade ${process.env.XFADE} s loop seam (equal power)`, `opus ${process.env.BITRATE.replace("k"," kbps")} stereo`
    ]
  };
});
fs.writeFileSync(process.env.OUT + "/manifest.json", JSON.stringify({ files }, null, 2) + "\n");
'
echo "manifest written"

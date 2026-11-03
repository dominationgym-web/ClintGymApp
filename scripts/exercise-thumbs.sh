#!/usr/bin/env bash
# Makes a small still picture (jpg) from every uploaded exercise clip.
# Usage: scripts/exercise-thumbs.sh OUTDIR
# Needs ffmpeg, curl, jq. Skips pictures that already exist (cached).
set -uo pipefail
out="${1:?output folder}"
base="${SUPABASE_URL:-https://vrasgqqubyurzoknsbgm.supabase.co}"
key="${SUPABASE_ANON_KEY:-}"
mkdir -p "$out"
# The live list (migration 0187) picks up clips added later; the saved list
# (scripts/exercise-clips.txt, the 412 clips on 2026-11-03) is the fallback.
names=$(curl -fsS -X POST "$base/rest/v1/rpc/exercise_clip_files" \
  -H "apikey: $key" -H "Authorization: Bearer $key" -H "Content-Type: application/json" -d '{}' | jq -r '.[]' 2>/dev/null) || names=""
if [ -z "$names" ]; then
  echo "Using the saved clip list"
  names=$(cat "$(dirname "$0")/exercise-clips.txt")
fi
made=0; have=0; failed=0
for n in $names; do
  [[ "$n" =~ ^[A-Za-z0-9._-]+\.mp4$ ]] || continue
  jpg="$out/${n%.mp4}.jpg"
  if [ -s "$jpg" ]; then have=$((have+1)); continue; fi
  url="$base/storage/v1/object/public/exercise-library/$n"
  if ffmpeg -v error -y -ss 1 -i "$url" -frames:v 1 -vf scale=320:-2 -q:v 6 "$jpg" </dev/null && [ -s "$jpg" ]; then
    made=$((made+1))
  elif ffmpeg -v error -y -ss 0 -i "$url" -frames:v 1 -vf scale=320:-2 -q:v 6 "$jpg" </dev/null && [ -s "$jpg" ]; then
    made=$((made+1))
  else
    rm -f "$jpg"; failed=$((failed+1)); echo "No picture for $n"
  fi
done
echo "Thumbnails: $made made, $have already there, $failed failed"

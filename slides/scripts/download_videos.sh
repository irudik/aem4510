#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

MANIFEST="video_manifest.csv"
OUTDIR="videos"

mkdir -p "$OUTDIR"

tail -n +2 "$MANIFEST" | while IFS=, read -r id filename slide_file line context; do
  if [ -f "$OUTDIR/$filename" ]; then
    echo "Skipping (exists): $filename"
  else
    echo "Downloading: $filename ($context)"
    yt-dlp \
      -f "bv*[ext=mp4]+ba[ext=m4a]/mp4" \
      --merge-output-format mp4 \
      -o "$OUTDIR/$filename" \
      "https://www.youtube.com/watch?v=$id"
  fi
done
echo "Done. All videos in $OUTDIR/"

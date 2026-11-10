#!/usr/bin/env sh
# Lädt das Dashboard-Bild passend zum Akkustand (dash-0.png … dash-100.png) nach "$1".
# Die Basis-URL steht in url.txt daneben (nicht im Repo, enthält den geheimen Pfad).
DIR="$(dirname "$0")"
BASE="$(tr -d '\r\n' < "$DIR/url.txt")"

level=$(gasgauge-info -c | tr -dc '0-9')
[ -z "$level" ] && level=100
step=$(( (level + 5) / 10 * 10 ))
[ "$step" -gt 100 ] && step=100

tmp="$1.tmp"
"$DIR/../xh" -d -q --verify="$DIR/../ca-bundle.crt" --timeout 30 -o "$tmp" get "$BASE/dash-$step.png" || exit 1

# Nur ein gültiges PNG übernehmen (sonst bleibt das alte Bild stehen)
if [ "$(head -c 4 "$tmp" | tail -c 3)" = "PNG" ]; then
  mv "$tmp" "$1"
else
  rm -f "$tmp"
  exit 1
fi

#!/bin/sh
# Render top/bottom/inner views of the board to PNG (needs kicad-cli + chromium)
PCB=${1:-../ai_glasses.kicad_pcb}
OUT=${2:-../docs/img}
CHROME=${CHROME:-$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1)}
mkdir -p "$OUT"
render() {  # name layers [extra]
  kicad-cli pcb export svg --exclude-drawing-sheet --page-size-mode 2 $3 \
    -l "$2" -o "$OUT/$1.svg" "$PCB" >/dev/null 2>&1
  # white background + scale up for legibility
  python3 - "$OUT/$1.svg" <<'PY'
import re, sys
p = sys.argv[1]; s = open(p).read()
m = re.search(r'width="([\d.]+)(\w*)" height="([\d.]+)(\w*)"', s)
w, h = float(m.group(1)), float(m.group(3))
s = s.replace(m.group(0), 'width="%dpx" height="%dpx"' % (w * 12, h * 12), 1)
s = re.sub(r'(<svg[^>]*>)', r'\1<rect width="100%" height="100%" fill="white"/>', s, 1)
open(p, "w").write(s)
PY
  W=$(grep -o 'width="[0-9]*px"' "$OUT/$1.svg" | head -1 | tr -dc 0-9)
  H=$(grep -o 'height="[0-9]*px"' "$OUT/$1.svg" | head -1 | tr -dc 0-9)
  "$CHROME" --headless --no-sandbox --disable-gpu --hide-scrollbars \
     --screenshot="$OUT/$1.png" --window-size="$W,$H" "file://$(realpath "$OUT/$1.svg")" >/dev/null 2>&1
  rm -f "$OUT/$1.svg"
}
render top    "F.Cu,F.Silkscreen,F.Fab,F.Courtyard,Edge.Cuts"
render bottom "B.Cu,B.Silkscreen,B.Fab,B.Courtyard,Edge.Cuts" "--mirror"
render in1    "In1.Cu,Edge.Cuts"
render in2    "In2.Cu,Edge.Cuts"
ls -la "$OUT"

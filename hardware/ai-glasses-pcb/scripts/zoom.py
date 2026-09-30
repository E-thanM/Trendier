"""Render a zoomed region of the board (no pours) to PNG for inspection.
usage: zoom.py board.kicad_pcb out.png x0 y0 x1 y1 [layers]   (local mm)"""
import os, re, subprocess, sys, tempfile, glob
import pcbnew
import design as D
src, out = sys.argv[1], sys.argv[2]
x0, y0, x1, y1 = map(float, sys.argv[3:7])
layers = sys.argv[7] if len(sys.argv) > 7 else "F.Cu,B.Cu,F.Fab,Edge.Cuts"
tmp = tempfile.mkdtemp()
b = pcbnew.LoadBoard(src)
KEEP_ZONES = os.environ.get("ZOOM_ZONES") == "1"
if KEEP_ZONES:
    pcbnew.ZONE_FILLER(b).Fill(b.Zones())
for z in ([] if KEEP_ZONES else list(b.Zones())):
    if not z.GetIsRuleArea():
        b.Remove(z)
# anchor marks so the SVG page origin is known: board bbox corners
p = os.path.join(tmp, "z.kicad_pcb")
pcbnew.SaveBoard(p, b)
svg = os.path.join(tmp, "z.svg")
subprocess.run(["kicad-cli", "pcb", "export", "svg", "--exclude-drawing-sheet", "--page-size-mode", "0",
                "-l", layers, "-o", svg, p], check=True, capture_output=True)
s = open(svg).read()
# page mode 0 = full A4/A3 page in mm with 1:1 board coords
ox, oy = D.OFFSET
vb = f'viewBox="{x0 + ox} {y0 + oy} {x1 - x0} {y1 - y0}"'
s = re.sub(r'viewBox="[^"]*"', vb, s, 1)
scale = 60
s = re.sub(r'width="[^"]*" height="[^"]*"', f'width="{int((x1 - x0) * scale)}px" height="{int((y1 - y0) * scale)}px"', s, 1)
s = re.sub(r'(<svg[^>]*>)', r'\1<rect x="0" y="0" width="1000" height="1000" fill="white"/>', s, 1)
open(svg, "w").write(s)
chrome = glob.glob("/opt/pw-browsers/chromium-*/chrome-linux/chrome")[0]
subprocess.run([chrome, "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
                f"--screenshot={out}", f"--window-size={int((x1 - x0) * scale)},{int((y1 - y0) * scale)}",
                "file://" + svg], capture_output=True)
print(out)

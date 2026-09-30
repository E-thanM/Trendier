"""Geometry audit of the routed board (antenna, stray graphics, edge
distances, USB pair, amp supply)."""
import math
import sys

import pcbnew

import design as D
from fanout import board_edges, point_in_board, seg_dist, to_mm

path = sys.argv[1] if len(sys.argv) > 1 else "../ai_glasses.kicad_pcb"
b = pcbnew.LoadBoard(path)
pcbnew.ZONE_FILLER(b).Fill(b.Zones())
ox, oy = D.OFFSET
edges = board_edges(b)
K = ox + D.ANTENNA_KEEPOUT_X
CU = [pcbnew.F_Cu, pcbnew.In1_Cu, pcbnew.In2_Cu, pcbnew.B_Cu]


def L(x, y):
    return round(x - ox, 2), round(y - oy, 2)


print("== 1. antenna keep-out (x < %.2f mm local, all copper layers)" % D.ANTENNA_KEEPOUT_X)
bad = []
for t in b.GetTracks():
    if t.GetBoundingBox().GetLeft() / 1e6 < K:
        bad.append((t.GetClass(), t.GetNetname(), L(*to_mm(t.GetPosition()))))
for p in b.GetPads():
    if p.GetAttribute() != pcbnew.PAD_ATTRIB_NPTH and p.GetBoundingBox().GetLeft() / 1e6 < K:
        bad.append(("pad", p.GetParent().GetReference() + "." + p.GetNumber(), L(*to_mm(p.GetPosition()))))
for z in b.Zones():
    if z.GetIsRuleArea():
        continue
    for l in CU:
        if not z.IsOnLayer(l):
            continue
        fp = z.GetFilledPolysList(l)
        if fp.OutlineCount() and fp.BBox().GetLeft() / 1e6 < K:
            bad.append(("zone fill", z.GetNetname(), pcbnew.LayerName(l), round(fp.BBox().GetLeft() / 1e6 - ox, 3)))
print("  copper inside keep-out:", bad or "none")
ra = [z for z in b.Zones() if z.GetIsRuleArea()]
for z in ra:
    bb = z.GetBoundingBox()
    print("  rule area %-16s layers=%s x %.2f..%.2f  tracks=%s vias=%s pour=%s" % (
        z.GetZoneName() or "(footprint)", ",".join(pcbnew.LayerName(l) for l in z.GetLayerSet().Seq()),
        bb.GetLeft() / 1e6 - ox, bb.GetRight() / 1e6 - ox,
        z.GetDoNotAllowTracks(), z.GetDoNotAllowVias(), z.GetDoNotAllowCopperPour()))
for fp in b.GetFootprints():
    for z in fp.Zones():
        bb = z.GetBoundingBox()
        print("  footprint %s rule area layers=%s x %.2f..%.2f" % (fp.GetReference(),
              ",".join(pcbnew.LayerName(l) for l in z.GetLayerSet().Seq()), bb.GetLeft() / 1e6 - ox, bb.GetRight() / 1e6 - ox))

print("== 2. graphics outside the outline / Edge.Cuts integrity")
polys = pcbnew.SHAPE_POLY_SET()
ok = b.GetBoardPolygonOutlines(polys)
print("  board outline closed:", ok, " outlines:", polys.OutlineCount(), " holes:", polys.HoleCount(0) if polys.OutlineCount() else "-")
ec = [d for d in b.GetDrawings() if d.GetLayer() == pcbnew.Edge_Cuts]
print("  Edge.Cuts items:", len(ec), " (segments+arcs)")
bb = b.GetBoardEdgesBoundingBox()
print("  outline bbox: %.2f x %.2f mm" % (bb.GetWidth() / 1e6, bb.GetHeight() / 1e6))


def outside(item_bb):
    return (item_bb.GetLeft() < bb.GetLeft() - 1000 or item_bb.GetRight() > bb.GetRight() + 1000 or
            item_bb.GetTop() < bb.GetTop() - 1000 or item_bb.GetBottom() > bb.GetBottom() + 1000)


for d in b.GetDrawings():
    if outside(d.GetBoundingBox()):
        print("  board-level graphic outside outline:", d.GetLayerName(), d.GetClass())
for fp in b.GetFootprints():
    for g in fp.GraphicalItems():
        if g.GetClass() in ("FP_TEXT", "PCB_TEXT"):
            continue
        if outside(g.GetBoundingBox()):
            gb = g.GetBoundingBox()
            print("  %s footprint graphic outside outline: layer %-12s x %.1f..%.1f y %.1f..%.1f" % (
                fp.GetReference(), g.GetLayerName(), gb.GetLeft() / 1e6 - ox, gb.GetRight() / 1e6 - ox,
                gb.GetTop() / 1e6 - oy, gb.GetBottom() / 1e6 - oy))

print("== 5. copper-to-edge distances")
worst = {}
for t in b.GetTracks():
    hw = t.GetWidth() / 2e6
    if isinstance(t, pcbnew.PCB_VIA):
        pts = [to_mm(t.GetPosition())]
    else:
        a, c = to_mm(t.GetStart()), to_mm(t.GetEnd())
        n = max(1, int(math.hypot(c[0] - a[0], c[1] - a[1]) / 0.1))
        pts = [(a[0] + (c[0] - a[0]) * i / n, a[1] + (c[1] - a[1]) * i / n) for i in range(n + 1)]
    for x, y in pts:
        d = min(seg_dist(x, y, *e) for e in edges) - hw
        region = "strip" if D.STRIP_X0 - 2 <= x - ox <= D.REAR_X0 + 2 else "other"
        if d < worst.get(region, (9, None))[0]:
            worst[region] = (d, t.GetNetname(), L(x, y), t.GetClass())
for r, v in worst.items():
    print("  min track/via-to-edge (%s): %.3f mm  %s" % (r, v[0], v[1:]))

print("== 7. USB pair")
for net in ("USB_DP", "USB_DM"):
    segs = [t for t in b.GetTracks() if t.GetNetname() == net]
    L_ = sum(t.GetLength() for t in segs if not isinstance(t, pcbnew.PCB_VIA)) / 1e6
    nv = sum(isinstance(t, pcbnew.PCB_VIA) for t in segs)
    layers = sorted({t.GetLayerName() for t in segs if not isinstance(t, pcbnew.PCB_VIA)})
    print("  %s: total copper length %.2f mm, vias %d, layers %s" % (net, L_, nv, layers))

print("== 3. amp supply (VSYS) widths by layer")
tot = {}
for t in b.GetTracks():
    if t.GetNetname() == "VSYS" and not isinstance(t, pcbnew.PCB_VIA):
        k = (t.GetLayerName(), round(t.GetWidth() / 1e6, 2))
        tot[k] = tot.get(k, 0) + t.GetLength() / 1e6
print("  ", {k: round(v, 1) for k, v in tot.items()})

"""GND stitching vias on a grid wherever a via fits clear of all other-net
copper. They tie the L1/L3/L4 ground pours to the L2 plane (and to each
other) and keep return paths short, especially along the thin strip."""
import math

import pcbnew

import design as D
from fanout import PadGeom, board_edges, point_in_board, seg_dist, to_mm

MM = pcbnew.FromMM
VIA_D, VIA_DRILL = 0.5, 0.25
CLR = 0.3
PITCH = 2.0


def stitch(board, net="GND"):
    ni = board.FindNet(net)
    pads = [PadGeom(p) for p in board.GetPads()]
    edges = board_edges(board)
    items = []   # (ax, ay, bx, by, halfwidth) other-net copper, any layer
    vias = []
    for t in board.GetTracks():
        if isinstance(t, pcbnew.PCB_VIA):
            vias.append(to_mm(t.GetPosition()))
            if t.GetNetname() != net:
                x, y = to_mm(t.GetPosition())
                items.append((x, y, x, y, t.GetWidth() / 2e6))
        elif t.GetNetname() != net:
            items.append((*to_mm(t.GetStart()), *to_mm(t.GetEnd()), t.GetWidth() / 2e6))
    # other-net zones (the In2 VSYS pour) are copper too
    zones = [z for z in board.Zones() if not z.GetIsRuleArea() and z.GetNetname() != net]
    placed = 0
    ox, oy = D.OFFSET
    y = oy + 0.8
    while y < oy + D.FRONT_H:
        x = ox + D.ANTENNA_KEEPOUT_X + 0.8
        while x < ox + D.REAR_X1:
            if ok(x, y, pads, items, vias, edges, zones):
                v = pcbnew.PCB_VIA(board)
                v.SetPosition(pcbnew.VECTOR2I(MM(x), MM(y)))
                v.SetWidth(MM(VIA_D))
                v.SetDrill(MM(VIA_DRILL))
                v.SetViaType(pcbnew.VIATYPE_THROUGH)
                v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu)
                v.SetNet(ni)
                board.Add(v)
                vias.append((x, y))
                placed += 1
            x += PITCH
        y += PITCH / 2
        # offset alternate rows for a staggered pattern
        ox = D.OFFSET[0] + (PITCH / 2 if round((y - oy) / (PITCH / 2)) % 2 else 0)
    return placed


def ok(x, y, pads, items, vias, edges, zones):
    if min(seg_dist(x, y, *e) for e in edges) < 0.7:
        return False
    if not point_in_board(x, y, edges):
        return False
    for p in pads:
        if p.hole_r and math.hypot(x - p.cx, y - p.cy) < p.hole_r + VIA_DRILL / 2 + 0.35:
            return False
        if p.dist(x, y) < VIA_D / 2 + CLR:
            return False
    for ax, ay, bx, by, hw in items:
        if seg_dist(x, y, ax, ay, bx, by) < VIA_D / 2 + hw + CLR:
            return False
    for vx, vy in vias:
        if math.hypot(x - vx, y - vy) < 1.5:
            return False
    pt = pcbnew.VECTOR2I(MM(x), MM(y))
    for z in zones:
        if z.Outline().Collide(pt, MM(VIA_D / 2 + CLR)):
            return False
    return True

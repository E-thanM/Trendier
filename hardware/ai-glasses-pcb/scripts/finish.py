"""Post-route clean-up helpers: trim off-board silkscreen, remove dangling
vias, widen a net where clearance allows, stitch a trace into a pour."""
import math

import pcbnew

import design as D
from fanout import PadGeom, board_edges, point_in_board, seg_dist, to_mm

MM = pcbnew.FromMM
CLR = 0.2
MAX_JOIN = 8.0


def _obstacles(board, net, layer):
    out = []
    for t in board.GetTracks():
        if t.GetNetname() == net:
            continue
        if isinstance(t, pcbnew.PCB_VIA):
            x, y = to_mm(t.GetPosition())
            out.append((x, y, x, y, t.GetWidth() / 2e6))
        elif t.GetLayer() == layer:
            out.append((*to_mm(t.GetStart()), *to_mm(t.GetEnd()), t.GetWidth() / 2e6))
    return out


def join_via(board, via, net="VSYS", width=0.5):
    """Short straight track from a trunk via to the closest same-net routed
    copper on F.Cu or B.Cu that it can reach without clearance problems."""
    vx, vy = to_mm(via.GetPosition())
    pads = [PadGeom(p) for p in board.GetPads()]
    best = None
    for t in board.GetTracks():
        if t.GetNetname() != net or isinstance(t, pcbnew.PCB_VIA) or t.IsLocked():
            continue
        layer = t.GetLayer()
        if layer not in (pcbnew.F_Cu, pcbnew.B_Cu):
            continue
        ax, ay = to_mm(t.GetStart())
        bx, by = to_mm(t.GetEnd())
        for i in range(21):
            tx, ty = ax + (bx - ax) * i / 20, ay + (by - ay) * i / 20
            d = math.hypot(tx - vx, ty - vy)
            if d > MAX_JOIN or (best and d >= best[0]):
                continue
            if clear_path(board, net, layer, vx, vy, tx, ty, width, pads):
                best = (d, layer, tx, ty)
    if not best:
        return None
    _, layer, tx, ty = best
    t = pcbnew.PCB_TRACK(board)
    t.SetStart(via.GetPosition())
    t.SetEnd(pcbnew.VECTOR2I(MM(tx), MM(ty)))
    t.SetWidth(MM(width))
    t.SetLayer(layer)
    t.SetNet(board.FindNet(net))
    board.Add(t)
    return best


def clear_path(board, net, layer, ax, ay, bx, by, w, pads):
    obst = _obstacles(board, net, layer)
    edges = board_edges(board)
    n = max(2, int(math.hypot(bx - ax, by - ay) / 0.05))
    for i in range(n + 1):
        x, y = ax + (bx - ax) * i / n, ay + (by - ay) * i / n
        if (not point_in_board(x, y, edges)
                or min(seg_dist(x, y, *e) for e in edges) < w / 2 + 0.3):
            return False
        for p in pads:
            if p.net != net and layer in p.layers and p.dist(x, y) < w / 2 + CLR:
                return False
        for (oax, oay, obx, oby, hw) in obst:
            if seg_dist(x, y, oax, oay, obx, oby) < w / 2 + hw + CLR:
                return False
    return True


def trim_silk(board):
    """Remove footprint silkscreen primitives that leave the board outline."""
    edges = board_edges(board)
    removed = 0
    for fp in board.GetFootprints():
        for g in list(fp.GraphicalItems()):
            if g.GetLayer() not in (pcbnew.F_SilkS, pcbnew.B_SilkS):
                continue
            bb = g.GetBoundingBox()
            corners = [(bb.GetLeft(), bb.GetTop()), (bb.GetRight(), bb.GetTop()),
                       (bb.GetLeft(), bb.GetBottom()), (bb.GetRight(), bb.GetBottom())]
            bad = False
            for cx, cy in corners:
                x, y = cx / 1e6, cy / 1e6
                if (not point_in_board(x, y, edges)
                        or min(seg_dist(x, y, *e) for e in edges) < 0.2):
                    bad = True
            if bad:
                fp.Remove(g)
                removed += 1
    return removed


def stitch_trace(board, net="VSYS", x_range=None, spacing=4.0, via_d=0.5, drill=0.25):
    """Drop vias onto the routed trace of `net` (inside x_range, local mm) so
    it is paralleled by that net's In2 pour."""
    ox = D.OFFSET[0]
    x0, x1 = x_range
    pads = [PadGeom(p) for p in board.GetPads()]
    edges = board_edges(board)
    other = []
    for t in board.GetTracks():
        if t.GetNetname() == net:
            continue
        if isinstance(t, pcbnew.PCB_VIA):
            x, y = to_mm(t.GetPosition())
            other.append((x, y, x, y, t.GetWidth() / 2e6))
        else:
            other.append((*to_mm(t.GetStart()), *to_mm(t.GetEnd()), t.GetWidth() / 2e6))
    allvias = [to_mm(t.GetPosition()) for t in board.GetTracks() if isinstance(t, pcbnew.PCB_VIA)]
    placed = []
    ni = board.FindNet(net)
    for t in list(board.GetTracks()):
        if t.GetNetname() != net or isinstance(t, pcbnew.PCB_VIA):
            continue
        ax, ay = to_mm(t.GetStart())
        bx, by = to_mm(t.GetEnd())
        n = max(1, int(math.hypot(bx - ax, by - ay) / 0.25))
        for i in range(n + 1):
            x, y = ax + (bx - ax) * i / n, ay + (by - ay) * i / n
            if not (ox + x0 <= x <= ox + x1):
                continue
            if any(math.hypot(x - px, y - py) < spacing for px, py in placed):
                continue
            if any(math.hypot(x - px, y - py) < via_d + 0.3 for px, py in allvias):
                continue
            if min(seg_dist(x, y, *e) for e in edges) < 0.7:
                continue
            if any(p.net != net and p.layers and p.dist(x, y) < via_d / 2 + CLR for p in pads):
                continue
            if any(p.hole_r and math.hypot(x - p.cx, y - p.cy) < p.hole_r + drill / 2 + 0.3
                   for p in pads):
                continue
            if any(seg_dist(x, y, oax, oay, obx, oby) < via_d / 2 + hw + CLR
                   for oax, oay, obx, oby, hw in other):
                continue
            v = pcbnew.PCB_VIA(board)
            v.SetPosition(pcbnew.VECTOR2I(MM(x), MM(y)))
            v.SetWidth(MM(via_d))
            v.SetDrill(MM(drill))
            v.SetViaType(pcbnew.VIATYPE_THROUGH)
            v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu)
            v.SetNet(ni)
            board.Add(v)
            placed.append((x, y))
            allvias.append((x, y))
    return len(placed)


def remove_dangling_vias(board):
    """Delete unlocked vias KiCad reports as dangling (stitch vias the pour
    didn't reach); they carry no connection."""
    import os
    import re
    import tempfile
    rpt = os.path.join(tempfile.mkdtemp(), "d.rpt")
    pcbnew.WriteDRCReport(board, rpt, pcbnew.EDA_UNITS_MILLIMETRES, True)
    spots = set()
    for m in re.finditer(r"\[via_dangling\].*\n.*\n\s*@\(([\d.]+) mm, ([\d.]+) mm\)", open(rpt).read()):
        spots.add((round(float(m.group(1)), 3), round(float(m.group(2)), 3)))
    n = 0
    for t in list(board.GetTracks()):
        if isinstance(t, pcbnew.PCB_VIA) and not t.IsLocked():
            x, y = to_mm(t.GetPosition())
            if (round(x, 3), round(y, 3)) in spots:
                board.Remove(t)
                n += 1
    return n


def widen_net(board, net, width, x_range):
    """Widen a net's track segments inside x_range (local mm) where DRC
    allows; each widened segment is re-checked and reverted on conflict."""
    import os
    import re
    import tempfile
    ox = D.OFFSET[0]
    segs = [t for t in board.GetTracks() if t.GetNetname() == net
            and not isinstance(t, pcbnew.PCB_VIA)
            and ox + x_range[0] <= to_mm(t.GetStart())[0] <= ox + x_range[1]
            and t.GetWidth() < MM(width)]
    old = {id(t): t.GetWidth() for t in segs}
    for t in segs:
        t.SetWidth(MM(width))
    for _ in range(6):
        pcbnew.ZONE_FILLER(board).Fill(board.Zones())
        rpt = os.path.join(tempfile.mkdtemp(), "w.rpt")
        pcbnew.WriteDRCReport(board, rpt, pcbnew.EDA_UNITS_MILLIMETRES, False)
        txt = open(rpt).read()
        bad = []
        for block in re.split(r"\n(?=\[)", txt):
            if "Severity: error" in block and f"[{net}]" in block and "Track" in block:
                for m in re.finditer(r"@\(([\d.]+) mm, ([\d.]+) mm\): Track \[" + re.escape(net), block):
                    bad.append((float(m.group(1)), float(m.group(2))))
        if not bad:
            break
        for t in segs:
            s, e = to_mm(t.GetStart()), to_mm(t.GetEnd())
            for x, y in bad:
                if seg_dist(x, y, *s, *e) < 0.05 and t.GetWidth() != old[id(t)]:
                    t.SetWidth(old[id(t)])
    return sum(1 for t in segs if t.GetWidth() == MM(width)), len(segs)

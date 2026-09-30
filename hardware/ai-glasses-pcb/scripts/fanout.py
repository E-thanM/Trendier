"""Place a short stub + via from every SMD GND pad down to the In1 GND plane.

Candidate positions are checked geometrically against every pad, hole,
previously placed via, the board edge and the antenna keep-out; KiCad's DRC
re-verifies the final result anyway.
"""
import math

import pcbnew

import design as D

MM = pcbnew.FromMM
VIA_D, VIA_DRILL = 0.5, 0.25
TRACK_W = 0.3
CLR = 0.16         # GND class clearance is 0.15
EDGE = 0.6         # via centre to board edge
STUB_CLR = 0.17


def to_mm(v):
    return v.x / 1e6, v.y / 1e6


class PadGeom:
    def __init__(self, pad):
        self.pad = pad
        self.cx, self.cy = to_mm(pad.GetPosition())
        sz = pad.GetSize()
        self.hw, self.hh = sz.x / 2e6, sz.y / 2e6
        self.ang = math.radians(pad.GetOrientationDegrees())
        self.net = pad.GetNetname()
        self.circle = pad.GetShape() == pcbnew.PAD_SHAPE_CIRCLE
        self.layers = {l for l in (pcbnew.F_Cu, pcbnew.In1_Cu, pcbnew.In2_Cu, pcbnew.B_Cu)
                       if pad.IsOnLayer(l) and pad.GetAttribute() != pcbnew.PAD_ATTRIB_NPTH}
        d = pad.GetDrillSize()
        self.hole_r = max(d.x, d.y) / 2e6 if d.x else 0.0

    def dist(self, x, y):
        """Distance from point to the pad copper (0 inside)."""
        dx, dy = x - self.cx, y - self.cy
        if self.circle:
            return max(0.0, math.hypot(dx, dy) - self.hw)
        c, s = math.cos(self.ang), math.sin(self.ang)
        lx, ly = dx * c - dy * s, dx * s + dy * c
        ex, ey = max(abs(lx) - self.hw, 0), max(abs(ly) - self.hh, 0)
        return math.hypot(ex, ey)


def seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    L = vx * vx + vy * vy
    t = 0 if L == 0 else max(0, min(1, ((px - ax) * vx + (py - ay) * vy) / L))
    return math.hypot(px - (ax + t * vx), py - (ay + t * vy))


def board_edges(board):
    segs = []
    for d in board.GetDrawings():
        if d.GetLayer() != pcbnew.Edge_Cuts:
            continue
        if d.GetShape() == pcbnew.SHAPE_T_SEGMENT:
            segs.append((*to_mm(d.GetStart()), *to_mm(d.GetEnd())))
        elif d.GetShape() == pcbnew.SHAPE_T_ARC:
            c = to_mm(d.GetCenter())
            r = d.GetRadius() / 1e6
            a0 = math.radians(d.GetArcAngleStart().AsDegrees())
            sweep = math.radians(d.GetArcAngle().AsDegrees())
            pts = [(c[0] + r * math.cos(a0 + sweep * i / 12),
                    c[1] + r * math.sin(a0 + sweep * i / 12)) for i in range(13)]
            segs += [(*a, *b) for a, b in zip(pts, pts[1:])]
    return segs


def fanout(board, net="GND", only=None):
    pads = [PadGeom(p) for p in board.GetPads()]
    edges = board_edges(board)
    outline = board.GetBoardEdgesBoundingBox()
    netinfo = board.FindNet(net)
    vias = [to_mm(v.GetPosition()) for v in board.GetTracks()
            if isinstance(v, pcbnew.PCB_VIA)]
    tracks = []     # (layer, ax, ay, bx, by) of stubs we add
    # already-routed copper of other nets: (layer, ax, ay, bx, by, half_width)
    foreign = []
    for t in board.GetTracks():
        if t.GetNetname() == net:
            continue
        if isinstance(t, pcbnew.PCB_VIA):
            x, y = to_mm(t.GetPosition())
            for l in (pcbnew.F_Cu, pcbnew.In1_Cu, pcbnew.In2_Cu, pcbnew.B_Cu):
                foreign.append((l, x, y, x, y, t.GetWidth() / 2e6))
        else:
            foreign.append((t.GetLayer(), *to_mm(t.GetStart()), *to_mm(t.GetEnd()),
                            t.GetWidth() / 2e6))
    placed = 0
    failed = []

    def inside(x, y):
        poly = board.GetBoardPolygonOutlines() if False else None
        return outline.Contains(pcbnew.VECTOR2I(MM(x), MM(y)))

    def via_ok(x, y, own):
        if x - D.OFFSET[0] < D.ANTENNA_KEEPOUT_X + VIA_D / 2 + 0.1:
            return False
        if min(seg_dist(x, y, *e) for e in edges) < EDGE:
            return False
        if not point_in_board(x, y, edges):
            return False
        for p in pads:
            if p is own:
                if p.dist(x, y) < VIA_D / 2 + 0.1:
                    return False
                continue
            if p.hole_r and math.hypot(x - p.cx, y - p.cy) < p.hole_r + VIA_DRILL / 2 + 0.3:
                return False
            if p.layers and p.dist(x, y) < VIA_D / 2 + CLR:
                return False
        for vx, vy in vias:
            if math.hypot(x - vx, y - vy) < VIA_D + 0.3:
                return False
        for (_, ax, ay, bx, by) in tracks:
            if seg_dist(x, y, ax, ay, bx, by) < VIA_D / 2 + TRACK_W / 2 + CLR:
                return False
        for (_, ax, ay, bx, by, hw) in foreign:
            if seg_dist(x, y, ax, ay, bx, by) < VIA_D / 2 + hw + CLR:
                return False
        return True

    def stub_ok(layer, ax, ay, bx, by, own, w=TRACK_W, target=None):
        n = max(2, int(math.hypot(bx - ax, by - ay) / 0.05))
        for i in range(n + 1):
            x, y = ax + (bx - ax) * i / n, ay + (by - ay) * i / n
            for p in pads:
                if p is own or p is target or layer not in p.layers:
                    continue
                if p.net == net and p.pad.GetParent() is own.pad.GetParent():
                    # merging with a same-net pad of the same part is fine
                    continue
                if p.dist(x, y) < w / 2 + STUB_CLR:
                    return False
            for vx, vy in vias:
                if math.hypot(x - vx, y - vy) < VIA_D / 2 + w / 2 + CLR:
                    return False
            for (l, fax, fay, fbx, fby, hw) in foreign:
                if l == layer and seg_dist(x, y, fax, fay, fbx, fby) < w / 2 + hw + CLR:
                    return False
        return True

    def add_track(layer, ax, ay, bx, by, w):
        t = pcbnew.PCB_TRACK(board)
        t.SetStart(pcbnew.VECTOR2I(MM(ax), MM(ay)))
        t.SetEnd(pcbnew.VECTOR2I(MM(bx), MM(by)))
        t.SetWidth(MM(w))
        t.SetLayer(layer)
        t.SetNet(netinfo)
        t.SetLocked(True)
        board.Add(t)
        tracks.append((layer, ax, ay, bx, by))

    todo = [p for p in pads if p.net == net and p.pad.GetAttribute() == pcbnew.PAD_ATTRIB_SMD
            and (only is None or (p.pad.GetParent().GetReference(), p.pad.GetNumber()) in only)]
    for p in todo:
        fp = p.pad.GetParent()
        # pads stitched by the footprint's own thermal vias (ESP32 / amp EPAD)
        if any(q.GetNumber() == p.pad.GetNumber() and
               q.GetAttribute() == pcbnew.PAD_ATTRIB_PTH for q in fp.Pads()):
            continue
        fx, fy = to_mm(fp.GetPosition())
        layer = pcbnew.F_Cu if p.pad.IsOnLayer(pcbnew.F_Cu) else pcbnew.B_Cu
        base = math.atan2(p.cy - fy, p.cx - fx) if (p.cx, p.cy) != (fx, fy) else 0
        best = None
        for step in range(0, 20):
            r = max(p.hw, p.hh) * 0.5 + VIA_D / 2 + 0.25 + step * 0.1
            for k in range(24):
                # search angles closest to "away from the part centre" first
                off = ((k + 1) // 2) * (1 if k % 2 else -1) * math.pi / 12
                a = base + off
                x, y = p.cx + r * math.cos(a), p.cy + r * math.sin(a)
                if via_ok(x, y, p) and stub_ok(layer, p.cx, p.cy, x, y, p):
                    best = (x, y)
                    break
            if best:
                break
        if not best:
            # fall back: short stub into a same-net pad of the same part that
            # is already stitched (e.g. QFN GND pin -> exposed pad)
            done = False
            for q in pads:
                if (q is p or q.net != net or q.pad.GetParent() is not fp
                        or layer not in q.layers or not any(
                            r.GetNumber() == q.pad.GetNumber() and
                            r.GetAttribute() == pcbnew.PAD_ATTRIB_PTH for r in fp.Pads())):
                    continue
                if stub_ok(layer, p.cx, p.cy, q.cx, q.cy, p, w=0.2, target=q):
                    add_track(layer, p.cx, p.cy, q.cx, q.cy, 0.2)
                    placed += 1
                    done = True
                    break
            if not done:
                failed.append(f"{fp.GetReference()}.{p.pad.GetNumber()}")
            continue
        x, y = best
        t = pcbnew.PCB_TRACK(board)
        t.SetStart(pcbnew.VECTOR2I(MM(p.cx), MM(p.cy)))
        t.SetEnd(pcbnew.VECTOR2I(MM(x), MM(y)))
        t.SetWidth(MM(TRACK_W))
        t.SetLayer(layer)
        t.SetNet(netinfo)
        t.SetLocked(True)
        board.Add(t)
        v = pcbnew.PCB_VIA(board)
        v.SetPosition(pcbnew.VECTOR2I(MM(x), MM(y)))
        v.SetWidth(MM(VIA_D))
        v.SetDrill(MM(VIA_DRILL))
        v.SetViaType(pcbnew.VIATYPE_THROUGH)
        v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu)
        v.SetNet(netinfo)
        v.SetLocked(True)
        board.Add(v)
        vias.append((x, y))
        tracks.append((layer, p.cx, p.cy, x, y))
        placed += 1
    return placed, failed


def point_in_board(x, y, edges):
    """Even-odd ray cast against the (segmented) outline."""
    inside = False
    for ax, ay, bx, by in edges:
        if (ay > y) != (by > y):
            xi = ax + (y - ay) * (bx - ax) / (by - ay)
            if xi > x:
                inside = not inside
    return inside

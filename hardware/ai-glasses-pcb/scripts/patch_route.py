"""Deterministic fallback router for the last few connections Freerouting
leaves open: grid A* (0.05 mm) on F.Cu / In2.Cu / B.Cu with through vias.

Obstacles are all copper of other nets inflated by the net-class clearance
plus half the track width, the board-edge band, and the antenna keep-out.
KiCad's DRC re-checks everything afterwards.
"""
import heapq
import math

import numpy as np
import pcbnew

import design as D
from fanout import board_edges, point_in_board, seg_dist, to_mm

MM = pcbnew.FromMM
RES = 0.05
LAYERS = [pcbnew.F_Cu, pcbnew.In2_Cu, pcbnew.B_Cu]
VIA_D, VIA_DRILL = 0.5, 0.25
EDGE_KEEP = 0.45     # via-centre/grid keep; tracks add their half width (see route_net)
TRACK_EDGE = 0.5     # matches ai_glasses.kicad_dru
VIA_COST = 40.0


WIDTH_OVERRIDE = {}     # net -> track width (mm) for this run


def netclass_of(net):
    if net in WIDTH_OVERRIDE:
        return WIDTH_OVERRIDE[net], 0.15
    for name, (tw, clr, *_rest, nets) in D.NETCLASSES.items():
        if nets and net in nets:
            return tw, clr
    tw, clr, *_ = D.NETCLASSES["Default"]
    return tw, clr


class Grid:
    def __init__(self, board):
        self.board = board
        bb = board.GetBoardEdgesBoundingBox()
        self.x0, self.y0 = bb.GetLeft() / 1e6 - 0.5, bb.GetTop() / 1e6 - 0.5
        self.nx = int((bb.GetWidth() / 1e6 + 1) / RES) + 1
        self.ny = int((bb.GetHeight() / 1e6 + 1) / RES) + 1
        self.edges = board_edges(board)
        # distance-to-edge + inside mask, computed once
        xs = self.x0 + np.arange(self.nx) * RES
        ys = self.y0 + np.arange(self.ny) * RES
        self.X, self.Y = np.meshgrid(xs, ys)          # [ny, nx]
        inside = np.zeros_like(self.X, dtype=bool)
        for ax, ay, bx, by in self.edges:              # even-odd fill
            cond = (ay > self.Y) != (by > self.Y)
            with np.errstate(divide="ignore", invalid="ignore"):
                xi = ax + (self.Y - ay) * (bx - ax) / (by - ay)
            inside ^= cond & (self.X < xi)
        dmin = np.full_like(self.X, 1e9)
        for ax, ay, bx, by in self.edges:
            dmin = np.minimum(dmin, self._segdist(ax, ay, bx, by, 0))
        self.edge_dist = np.where(inside, dmin, -1.0)
        self.edge_ok = inside & (dmin >= EDGE_KEEP)
        self.edge_ok &= self.X >= D.OFFSET[0] + D.ANTENNA_KEEPOUT_X + 0.3
        # rule areas (keep-outs): per-layer track block + via block
        self.rule_track = {l: np.zeros_like(inside) for l in LAYERS}
        self.rule_via = np.zeros_like(inside)
        self.usb_via = np.zeros_like(inside)     # non-GND vias only (kicad_dru rule)
        for z in board.Zones():
            if not z.GetIsRuleArea():
                continue
            o = z.Outline()
            pts = [(o.CVertex(k).x / 1e6, o.CVertex(k).y / 1e6) for k in range(o.TotalVertices())]
            m = np.zeros_like(inside)
            for (ax, ay), (bx, by) in zip(pts, pts[1:] + pts[:1]):
                cond = (ay > self.Y) != (by > self.Y)
                with np.errstate(divide="ignore", invalid="ignore"):
                    xi = ax + (self.Y - ay) * (bx - ax) / (by - ay)
                m ^= cond & (self.X < xi)
            # grow by a track/via margin so copper edges also stay out
            for (ax, ay), (bx, by) in zip(pts, pts[1:] + pts[:1]):
                m |= self._segdist(ax, ay, bx, by, 0) < 0.45
            if z.GetDoNotAllowTracks():
                for l in LAYERS:
                    if z.IsOnLayer(l):
                        self.rule_track[l] |= m
            if z.GetDoNotAllowVias():
                self.rule_via |= m
            if z.GetZoneName() == "USB_VIA_KEEPOUT":
                self.usb_via |= m

    def _segdist(self, ax, ay, bx, by, hw, sl=None):
        X, Y = (self.X, self.Y) if sl is None else (self.X[sl], self.Y[sl])
        vx, vy = bx - ax, by - ay
        L = vx * vx + vy * vy
        if L == 0:
            t = 0
        else:
            t = np.clip(((X - ax) * vx + (Y - ay) * vy) / L, 0, 1)
        return np.hypot(X - (ax + t * vx), Y - (ay + t * vy)) - hw

    def window(self, x0, y0, x1, y1):
        i0 = max(0, int((y0 - self.y0) / RES)); i1 = min(self.ny, int((y1 - self.y0) / RES) + 2)
        j0 = max(0, int((x0 - self.x0) / RES)); j1 = min(self.nx, int((x1 - self.x0) / RES) + 2)
        return (slice(i0, i1), slice(j0, j1))

    def cell(self, x, y):
        return int(round((y - self.y0) / RES)), int(round((x - self.x0) / RES))

    def xy(self, i, j):
        return float(self.x0 + j * RES), float(self.y0 + i * RES)


def copper_items(board):
    """(net, layers, kind, geometry) for every copper item."""
    out = []
    for p in board.GetPads():
        pos = p.GetPosition()
        sz = p.GetSize()
        layers = [l for l in LAYERS if p.IsOnLayer(l)]
        if p.GetShape() == pcbnew.PAD_SHAPE_CUSTOM:
            bb = p.GetBoundingBox()
            out.append((p.GetNetname(), layers, "pad",
                        (bb.GetCenter().x / 1e6, bb.GetCenter().y / 1e6,
                         bb.GetWidth() / 2e6, bb.GetHeight() / 2e6, 0.0, False)))
            continue
        if p.GetDrillSize().x and p.GetAttribute() == pcbnew.PAD_ATTRIB_PTH:
            out.append(("__hole__", [], "circle",
                        (pos.x / 1e6, pos.y / 1e6, p.GetDrillSize().x / 2e6)))
        if p.GetAttribute() == pcbnew.PAD_ATTRIB_NPTH:
            d = p.GetDrillSize().x / 2e6
            out.append((None, LAYERS, "circle", (pos.x / 1e6, pos.y / 1e6, d)))
            continue
        out.append((p.GetNetname(), layers, "pad",
                    (pos.x / 1e6, pos.y / 1e6, sz.x / 2e6, sz.y / 2e6,
                     math.radians(p.GetOrientationDegrees()),
                     p.GetShape() == pcbnew.PAD_SHAPE_CIRCLE)))
    for t in board.GetTracks():
        if isinstance(t, pcbnew.PCB_VIA):
            x, y = to_mm(t.GetPosition())
            out.append((t.GetNetname(), LAYERS, "circle", (x, y, t.GetWidth() / 2e6)))
        else:
            if t.GetLayer() not in LAYERS:
                continue
            out.append((t.GetNetname(), [t.GetLayer()], "seg",
                        (*to_mm(t.GetStart()), *to_mm(t.GetEnd()), t.GetWidth() / 2e6)))
    return out


def dist_field(g, kind, geo, sl):
    X, Y = g.X[sl], g.Y[sl]
    if kind == "circle":
        x, y, r = geo
        return np.hypot(X - x, Y - y) - r
    if kind == "seg":
        return g._segdist(*geo[:4], geo[4], sl)
    x, y, hw, hh, ang, circ = geo
    if circ:
        return np.hypot(X - x, Y - y) - hw
    c, s = math.cos(ang), math.sin(ang)
    dx, dy = X - x, Y - y
    lx, ly = dx * c - dy * s, dx * s + dy * c
    ex, ey = np.maximum(np.abs(lx) - hw, 0), np.maximum(np.abs(ly) - hh, 0)
    return np.hypot(ex, ey)


def bbox(kind, geo, m):
    if kind == "circle":
        x, y, r = geo
        return x - r - m, y - r - m, x + r + m, y + r + m
    if kind == "seg":
        ax, ay, bx, by, hw = geo
        return min(ax, bx) - hw - m, min(ay, by) - hw - m, max(ax, bx) + hw + m, max(ay, by) + hw + m
    x, y, hw, hh = geo[:4]
    r = math.hypot(hw, hh)
    return x - r - m, y - r - m, x + r + m, y + r + m


def route_net(board, g, net, items):
    tw, clr = netclass_of(net)
    ly = len(LAYERS)
    edge_ok = g.edge_ok & (g.edge_dist >= TRACK_EDGE + tw / 2 + 0.02)
    free = np.stack([edge_ok & ~g.rule_track[l] for l in LAYERS])
    via_ok = g.edge_ok & (g.edge_dist >= TRACK_EDGE + VIA_D / 2 + 0.02) & ~g.rule_via
    if net != "GND":
        via_ok &= ~g.usb_via
    own = [np.zeros_like(g.edge_ok) for _ in LAYERS]
    for inet, layers, kind, geo in items:
        if inet == net and kind == "pad":
            mv = VIA_D / 2 + 0.15
            sl = g.window(*bbox(kind, geo, mv))
            via_ok[sl] &= dist_field(g, kind, geo, sl) >= mv
        if inet == net:
            m = 0.0
            sl = g.window(*bbox(kind, geo, m))
            d = dist_field(g, kind, geo, sl)
            for li, l in enumerate(LAYERS):
                if l in layers:
                    own[li][sl] |= d <= 0
            continue
        m = tw / 2 + max(clr, 0.15) + 0.01
        mv = VIA_D / 2 + max(clr, 0.15) + 0.01
        sl = g.window(*bbox(kind, geo, max(m, mv)))
        d = dist_field(g, kind, geo, sl)
        for li, l in enumerate(LAYERS):
            if l in layers:
                free[li][sl] &= d >= m
        via_ok[sl] &= d >= mv
        if kind == "circle" and inet in (None, "__hole__"):   # hole clearance
            via_ok[sl] &= d >= VIA_DRILL / 2 + 0.25
    # own copper cells are passable (start/goal regions)
    comps = components(board, net)
    if len(comps) < 2:
        return None
    src = comps[0]

    def cells_of(group):
        cs = set()
        for li, l in enumerate(LAYERS):
            for (kind, geo, layers) in group:
                if l not in layers:
                    continue
                sl = g.window(*bbox(kind, geo, 0))
                d = dist_field(g, kind, geo, sl)
                ii, jj = np.nonzero(d <= -0.02 if kind != "pad" else d <= 0)
                for i, j in zip(ii + sl[0].start, jj + sl[1].start):
                    cs.add((li, i, j))
        return cs
    start = cells_of(src)
    goal = cells_of([x for c in comps[1:] for x in c])
    for (li, i, j) in start | goal:
        free[li][i, j] = True
    gi = np.array([[i, j] for _, i, j in goal])
    gc = gi.mean(axis=0)

    def h(i, j):
        return math.hypot(i - gc[0], j - gc[1]) * 0.5

    moves = [(-1, 0, 1), (1, 0, 1), (0, -1, 1), (0, 1, 1),
             (-1, -1, 1.414), (-1, 1, 1.414), (1, -1, 1.414), (1, 1, 1.414)]
    openh, came, cost = [], {}, {}
    for s in start:
        cost[s] = 0
        heapq.heappush(openh, (h(s[1], s[2]), 0, s))
    end = None
    expanded = 0
    while openh:
        f, c, cur = heapq.heappop(openh)
        if c > cost.get(cur, 1e18):
            continue
        if cur in goal:
            end = cur
            break
        expanded += 1
        if expanded > 3_000_000:
            break
        li, i, j = cur
        nbrs = []
        for di, dj, w in moves:
            ni, nj = i + di, j + dj
            if 0 <= ni < g.ny and 0 <= nj < g.nx and free[li][ni, nj]:
                nbrs.append(((li, ni, nj), w))
        if via_ok[i, j]:
            for l2 in range(ly):
                if l2 != li and free[l2][i, j] and via_ok[i, j]:
                    nbrs.append(((l2, i, j), VIA_COST))
        for nxt, w in nbrs:
            nc = c + w
            if nc < cost.get(nxt, 1e18):
                cost[nxt] = nc
                came[nxt] = cur
                heapq.heappush(openh, (nc + h(nxt[1], nxt[2]), nc, nxt))
    if end is None:
        return False
    global FREE
    FREE = free
    path = [end]
    while path[-1] in came:
        path.append(came[path[-1]])
    path.reverse()
    emit(board, g, net, tw, path)
    return True


FREE = None


def clear_line(free_l, a, b):
    (_, i0, j0), (_, i1, j1) = a, b
    n = max(abs(i1 - i0), abs(j1 - j0)) * 2
    for s in range(n + 1):
        i = round(i0 + (i1 - i0) * s / n)
        j = round(j0 + (j1 - j0) * s / n)
        if not free_l[i, j]:
            return False
    return True


def emit(board, g, net, tw, path):
    ni = board.FindNet(net)
    # split into per-layer runs, add vias at layer changes
    runs, cur = [], [path[0]]
    for a, b in zip(path, path[1:]):
        if a[0] != b[0]:
            runs.append(cur)
            v = pcbnew.PCB_VIA(board)
            x, y = g.xy(a[1], a[2])
            v.SetPosition(pcbnew.VECTOR2I(MM(x), MM(y)))
            v.SetWidth(MM(VIA_D)); v.SetDrill(MM(VIA_DRILL))
            v.SetViaType(pcbnew.VIATYPE_THROUGH)
            v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu)
            v.SetNet(ni)
            board.Add(v)
            cur = [b]
        else:
            cur.append(b)
    runs.append(cur)
    for run in runs:
        if len(run) < 2:
            continue
        # string-pulling: jump to the furthest cell with a clear straight line
        free_l = FREE[run[0][0]]
        pts = [run[0]]
        k = 0
        while k < len(run) - 1:
            m = len(run) - 1
            while m > k + 1 and not clear_line(free_l, run[k], run[m]):
                m -= 1
            pts.append(run[m])
            k = m
        layer = LAYERS[run[0][0]]
        for a, b in zip(pts, pts[1:]):
            t = pcbnew.PCB_TRACK(board)
            t.SetStart(pcbnew.VECTOR2I(MM(g.xy(a[1], a[2])[0]), MM(g.xy(a[1], a[2])[1])))
            t.SetEnd(pcbnew.VECTOR2I(MM(g.xy(b[1], b[2])[0]), MM(g.xy(b[1], b[2])[1])))
            t.SetWidth(MM(tw))
            t.SetLayer(layer)
            t.SetNet(ni)
            board.Add(t)


def components(board, net):
    """Connected groups of a net's copper (pads/tracks/vias), by contact."""
    items = []
    for p in board.GetPads():
        if p.GetNetname() == net:
            pos = p.GetPosition(); sz = p.GetSize()
            items.append(("pad", (pos.x / 1e6, pos.y / 1e6, sz.x / 2e6, sz.y / 2e6,
                                  math.radians(p.GetOrientationDegrees()),
                                  p.GetShape() == pcbnew.PAD_SHAPE_CIRCLE),
                          [l for l in LAYERS + [pcbnew.In1_Cu] if p.IsOnLayer(l)]))
    for t in board.GetTracks():
        if t.GetNetname() != net:
            continue
        if isinstance(t, pcbnew.PCB_VIA):
            x, y = to_mm(t.GetPosition())
            items.append(("circle", (x, y, t.GetWidth() / 2e6), LAYERS + [pcbnew.In1_Cu]))
        else:
            items.append(("seg", (*to_mm(t.GetStart()), *to_mm(t.GetEnd()), t.GetWidth() / 2e6),
                          [t.GetLayer()]))
    n = len(items)
    parent = list(range(n))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def pts(it):
        kind, geo, _ = it
        if kind == "seg":
            ax, ay, bx, by, hw = geo
            k = max(1, int(math.hypot(bx - ax, by - ay) / 0.05))
            return [(ax + (bx - ax) * i / k, ay + (by - ay) * i / k, hw) for i in range(k + 1)]
        return [(geo[0], geo[1], 0.0)]

    def touch(a, b):
        if not set(a[2]) & set(b[2]):
            return False
        for (x, y, r) in pts(a):
            if gdist(b, x, y) <= r + 1e-3:
                return True
        for (x, y, r) in pts(b):
            if gdist(a, x, y) <= r + 1e-3:
                return True
        return False

    for i in range(n):
        for j in range(i + 1, n):
            if find(i) != find(j) and touch(items[i], items[j]):
                parent[find(i)] = find(j)
    groups = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(items[i])
    return sorted(groups.values(), key=len, reverse=True)


def gdist(it, x, y):
    kind, geo, _ = it
    if kind == "circle":
        return max(0.0, math.hypot(x - geo[0], y - geo[1]) - geo[2])
    if kind == "seg":
        return max(0.0, seg_dist(x, y, *geo[:4]) - geo[4])
    cx, cy, hw, hh, ang, circ = geo
    if circ:
        return max(0.0, math.hypot(x - cx, y - cy) - hw)
    c, s = math.cos(ang), math.sin(ang)
    dx, dy = x - cx, y - cy
    lx, ly = dx * c - dy * s, dx * s + dy * c
    return math.hypot(max(abs(lx) - hw, 0), max(abs(ly) - hh, 0))


def patch(board, nets):
    g = Grid(board)
    done = {}
    for net in nets:
        items = copper_items(board)
        # connect groups one at a time until the net is whole
        for _ in range(8):
            r = route_net(board, g, net, items)
            if r is None:
                done[net] = True
                break
            if r is False:
                done[net] = False
                break
            items = copper_items(board)
    return done

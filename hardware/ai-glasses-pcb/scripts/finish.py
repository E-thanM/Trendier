"""Post-route clean-up: tie the VSYS trunk into the routed VSYS net and trim
footprint silkscreen that hangs past the board edge."""
import math

import pcbnew

import design as D
from fanout import PadGeom, board_edges, point_in_board, seg_dist, to_mm

MM = pcbnew.FromMM
CLR = 0.2


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
            if best and d >= best[0]:
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
    n = max(2, int(math.hypot(bx - ax, by - ay) / 0.05))
    for i in range(n + 1):
        x, y = ax + (bx - ax) * i / n, ay + (by - ay) * i / n
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


def finish(board):
    res = []
    vias = [t for t in board.GetTracks() if isinstance(t, pcbnew.PCB_VIA)
            and t.GetNetname() == "VSYS" and t.IsLocked()]
    for v in vias:
        res.append(join_via(board, v))
    return res, trim_silk(board)

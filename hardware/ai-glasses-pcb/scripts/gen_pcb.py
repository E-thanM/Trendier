"""Generate the (unrouted) 4-layer board from design.py using the pcbnew API."""
import math
import os
import sys

import pcbnew

import design as D
import project_files

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.normpath(os.path.join(HERE, ".."))
FPDIR = os.environ.get("KICAD_FOOTPRINT_DIR", "/usr/share/kicad/footprints")
MM = pcbnew.FromMM


def P(x, y):
    return pcbnew.VECTOR2I(MM(x + D.OFFSET[0]), MM(y + D.OFFSET[1]))


def fp_path(lib):
    if lib == "AI_Glasses":
        return os.path.join(PROJ, "AI_Glasses.pretty")
    return os.path.join(FPDIR, lib + ".pretty")


def outline_vertices():
    """Board outline corners (local mm, clockwise on screen) with the fillet
    radius used at each one."""
    r = D.CORNER_R
    return [
        ((0, 0), r),                                  # front-top
        ((D.REAR_X1, 0), r),                          # rear-top
        ((D.REAR_X1, D.FRONT_H), r),                  # rear-bottom
        ((D.REAR_X0, D.FRONT_H), D.FILLET_REAR_OUT),  # rear pad, front-bottom corner
        ((D.REAR_X0, D.STRIP_Y1), D.FILLET_NECK),     # inside corner strip -> rear pad
        ((D.STRIP_X0, D.STRIP_Y1), D.FILLET_TAPER),   # taper -> strip (inside)
        ((D.FRONT_W, D.FRONT_H), D.FILLET_TAPER),     # front bottom -> taper
        ((0, D.FRONT_H), r),                          # front-bottom
    ]


def fillet_geometry(verts):
    """-> list of ('seg', a, b) / ('arc', start, mid, end) primitives."""
    n = len(verts)
    corners = []
    for i, (p, r) in enumerate(verts):
        a, b = verts[i - 1][0], verts[(i + 1) % n][0]
        u1 = (a[0] - p[0], a[1] - p[1]); l1 = math.hypot(*u1); u1 = (u1[0] / l1, u1[1] / l1)
        u2 = (b[0] - p[0], b[1] - p[1]); l2 = math.hypot(*u2); u2 = (u2[0] / l2, u2[1] / l2)
        th = math.acos(max(-1.0, min(1.0, u1[0] * u2[0] + u1[1] * u2[1])))
        if r <= 0 or th > math.pi - 1e-6:
            corners.append((p, p, None))
            continue
        d = r / math.tan(th / 2)
        t1 = (p[0] + u1[0] * d, p[1] + u1[1] * d)
        t2 = (p[0] + u2[0] * d, p[1] + u2[1] * d)
        bis = (u1[0] + u2[0], u1[1] + u2[1]); lb = math.hypot(*bis); bis = (bis[0] / lb, bis[1] / lb)
        c = (p[0] + bis[0] * r / math.sin(th / 2), p[1] + bis[1] * r / math.sin(th / 2))
        mid = (c[0] - bis[0] * r, c[1] - bis[1] * r)
        corners.append((t1, t2, mid))
    prims = []
    for i in range(n):
        t1, t2, mid = corners[i]
        if mid is not None:
            prims.append(("arc", t1, mid, t2))
        nxt = corners[(i + 1) % n][0]
        prims.append(("seg", t2, nxt))
    return prims


def add_outline(board):
    """Edge.Cuts: straight segments + true arcs, every corner filleted."""
    for kind, *pts in fillet_geometry(outline_vertices()):
        s = pcbnew.PCB_SHAPE(board)
        if kind == "seg":
            s.SetShape(pcbnew.SHAPE_T_SEGMENT)
            s.SetStart(P(*pts[0]))
            s.SetEnd(P(*pts[1]))
        else:
            s.SetShape(pcbnew.SHAPE_T_ARC)
            s.SetArcGeometry(P(*pts[0]), P(*pts[1]), P(*pts[2]))
        s.SetLayer(pcbnew.Edge_Cuts)
        s.SetWidth(MM(0.1))
        board.Add(s)


def add_zone(board, layer, net, pts, priority=0, rule_area=False):
    z = pcbnew.ZONE(board)
    ls = pcbnew.LSET()
    for l in (layer if isinstance(layer, (list, tuple)) else [layer]):
        ls.AddLayer(l)
    z.SetLayerSet(ls)
    o = z.Outline()
    o.NewOutline()
    for x, y in pts:
        v = P(x, y)
        o.Append(v.x, v.y)
    if rule_area:
        z.SetIsRuleArea(True)
        z.SetDoNotAllowCopperPour(True)
        z.SetDoNotAllowVias(True)
        z.SetDoNotAllowTracks(True)
        z.SetDoNotAllowPads(False)
        z.SetDoNotAllowFootprints(False)
        z.SetZoneName("ANTENNA_KEEPOUT")
    else:
        z.SetNet(net)
        z.SetAssignedPriority(priority)
        z.SetLocalClearance(MM(0.2))
        z.SetMinThickness(MM(0.15))
        z.SetThermalReliefGap(MM(0.2))
        z.SetThermalReliefSpokeWidth(MM(0.25))
        z.SetPadConnection(pcbnew.ZONE_CONNECTION_THERMAL)
        z.SetIslandRemovalMode(pcbnew.ISLAND_REMOVAL_MODE_ALWAYS)
    board.Add(z)
    return z


ALL_CU = [pcbnew.F_Cu, pcbnew.In1_Cu, pcbnew.In2_Cu, pcbnew.B_Cu]
BIG = [(-2, -2), (D.REAR_X1 + 2, -2), (D.REAR_X1 + 2, D.FRONT_H + 2),
       (-2, D.FRONT_H + 2)]


def antenna_keepout(board):
    x = D.ANTENNA_KEEPOUT_X
    add_zone(board, ALL_CU, None, [(-1, -1), (x, -1), (x, D.FRONT_H + 1),
                                   (-1, D.FRONT_H + 1)], rule_area=True)


def add_via(board, net, x, y, locked=True):
    v = pcbnew.PCB_VIA(board)
    v.SetPosition(P(x, y))
    v.SetWidth(MM(0.5))
    v.SetDrill(MM(0.25))
    v.SetViaType(pcbnew.VIATYPE_THROUGH)
    v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu)
    v.SetNet(net)
    v.SetLocked(locked)
    board.Add(v)
    return v


def add_track(board, net, layer, a, b, width, locked=True):
    t = pcbnew.PCB_TRACK(board)
    t.SetStart(P(*a))
    t.SetEnd(P(*b))
    t.SetWidth(MM(width))
    t.SetLayer(layer)
    t.SetNet(net)
    t.SetLocked(locked)
    board.Add(t)
    return t


def build():
    project_files.write(PROJ)
    path = os.path.join(PROJ, project_files.NAME + ".kicad_pcb")
    board = pcbnew.NewBoard(path)
    board.SetCopperLayerCount(4)
    ds = board.GetDesignSettings()
    ds.SetBoardThickness(MM(D.BOARD_THICKNESS))
    board.SetLayerName(pcbnew.In1_Cu, "In1.Cu")
    board.SetLayerName(pcbnew.In2_Cu, "In2.Cu")
    board.SetLayerType(pcbnew.In1_Cu, pcbnew.LT_POWER)
    board.SetLayerType(pcbnew.In2_Cu, pcbnew.LT_MIXED)

    tb = board.GetTitleBlock()
    tb.SetTitle("AI Glasses - Temple PCB (ESP32-S3, camera, mic, bone conduction)")
    tb.SetRevision("1.0")
    tb.SetCompany("Trendier")
    tb.SetComment(0, "4-layer, 1.0 mm FR-4: L1 sig / L2 GND / L3 pwr+sig / L4 sig")

    nets = {}
    for n in D.nets():
        ni = pcbnew.NETINFO_ITEM(board, n)
        board.Add(ni)
        nets[n] = ni

    add_outline(board)

    for p in D.PARTS:
        lib, name = p["fp"].split(":")
        fp = pcbnew.FootprintLoad(fp_path(lib), name)
        if fp is None:
            sys.exit("footprint not found: " + p["fp"])
        fp.SetFPID(pcbnew.LIB_ID(lib, name))
        fp.SetReference(p["ref"])
        fp.SetValue(p["value"])
        fp.SetPath(pcbnew.KIID_PATH("/" + D.uuid_for(p["ref"])))
        x, y, rot, side = p["pos"]
        board.Add(fp)
        fp.SetPosition(P(x, y))
        fp.SetOrientationDegrees(rot)
        if side == "B":
            fp.Flip(fp.GetPosition(), True)
        # references live on the fab layer; keeps the tiny wearable board
        # free of illegible, overlapping silkscreen
        fp.Reference().SetLayer(pcbnew.B_Fab if side == "B" else pcbnew.F_Fab)
        fp.Reference().SetTextSize(pcbnew.VECTOR2I(MM(0.5), MM(0.5)))
        fp.Reference().SetTextThickness(MM(0.08))
        fp.Value().SetVisible(False)
        pinmap = p["pins"]
        for pad in fp.Pads():
            num = pad.GetNumber()
            if num == "":
                continue
            if num not in pinmap:
                sys.exit(f"{p['ref']} pad {num} missing from pin map")
            if pinmap[num]:
                pad.SetNet(nets[pinmap[num]])
        # every mapped pin must exist on the footprint
        padnums = {pad.GetNumber() for pad in fp.Pads()}
        for num in pinmap:
            if num not in padnums:
                sys.exit(f"{p['ref']} pin {num} has no pad on {p['fp']}")

    antenna_keepout(board)
    add_zone(board, pcbnew.In1_Cu, nets["GND"], BIG, priority=0)

    # silkscreen annotations
    def silk(text, x, y, layer=pcbnew.F_SilkS, size=0.8, rot=0):
        t = pcbnew.PCB_TEXT(board)
        t.SetText(text)
        t.SetPosition(P(x, y))
        t.SetLayer(layer)
        t.SetTextSize(pcbnew.VECTOR2I(MM(size), MM(size)))
        t.SetTextThickness(MM(0.15))
        t.SetTextAngleDegrees(rot)
        if layer in (pcbnew.B_SilkS,):
            t.SetMirrored(True)
        board.Add(t)

    silk("AI GLASSES  v1.0", (D.STRIP_X0 + D.STRIP_X1) / 2, D.STRIP_MID, size=1.0)
    silk("ESP32-S3 / DVP CAM / I2S MIC / BONE AUDIO",
         (D.STRIP_X0 + D.STRIP_X1) / 2, D.STRIP_MID, pcbnew.B_SilkS, size=0.8)
    pcbnew.SaveBoard(path, board)
    return path


if __name__ == "__main__":
    print(build())

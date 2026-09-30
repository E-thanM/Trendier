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


def add_outline(board):
    """Edge.Cuts: straight segments + true arcs at the rounded corners."""
    r = D.CORNER_R

    def seg(a, b):
        s = pcbnew.PCB_SHAPE(board)
        s.SetShape(pcbnew.SHAPE_T_SEGMENT)
        s.SetStart(P(*a))
        s.SetEnd(P(*b))
        s.SetLayer(pcbnew.Edge_Cuts)
        s.SetWidth(MM(0.1))
        board.Add(s)

    def arc(c, start, mid, end):
        s = pcbnew.PCB_SHAPE(board)
        s.SetShape(pcbnew.SHAPE_T_ARC)
        s.SetArcGeometry(P(*start), P(*mid), P(*end))
        s.SetLayer(pcbnew.Edge_Cuts)
        s.SetWidth(MM(0.1))
        board.Add(s)

    k = r * (1 - math.cos(math.radians(45)))
    W, H = D.REAR_X1, D.FRONT_H
    # top edge: straight from the front to the rear
    arc(None, (0, r), (k, k), (r, 0))
    seg((r, 0), (W - r, 0))
    arc(None, (W - r, 0), (W - k, k), (W, r))
    seg((W, r), (W, H - r))
    arc(None, (W, H - r), (W - k, H - k), (W - r, H))
    seg((W - r, H), (D.REAR_X0, H))
    # rear pad drops straight down onto the strip
    seg((D.REAR_X0, H), (D.REAR_X0, D.STRIP_Y1))
    seg((D.REAR_X0, D.STRIP_Y1), (D.STRIP_X0, D.STRIP_Y1))
    # bottom-edge taper up from the front section into the strip
    seg((D.STRIP_X0, D.STRIP_Y1), (D.FRONT_W, H))
    seg((D.FRONT_W, H), (r, H))
    arc(None, (r, H), (k, H - k), (0, H - r))
    seg((0, H - r), (0, r))


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

"""Hand-placed USB D+/D- coupled pair (F.Cu over the In1 GND plane).

w = 0.2 mm, gap = 0.15 mm (~90 ohm differential on the 1.0 mm 4-layer stack,
confirm with the fab's impedance calculator). The pair runs
J1 -> U8 connector-side pins (6/4) -> through U8 -> U8 MCU-side pins (1/3)
-> ESP32 IO20/IO19, so the ESD part is electrically between the connector
and everything else. Coordinates are local mm (design.py frame).
"""
import pcbnew

import design as D

W = 0.2
DP = [  # (layer, [points...]) polylines
    ("F.Cu", [(41.75, 14.64), (41.75, 13.75), (42.75, 13.75), (42.75, 14.64)]),   # A6-B6 bridge
    ("F.Cu", [(41.75, 13.75), (37.0, 13.75), (35.6, 15.15), (35.6, 15.45)]),       # -> U8.6
    ("F.Cu", [(35.6, 15.45), (33.263, 15.45)]),                                     # straight under U8 (6 -> 1)
    ("F.Cu", [(33.263, 15.45), (31.6, 15.45), (31.6, 18.75), (31.25, 19.1),
              (24.05, 19.1), (24.05, 19.3)]),                                        # U8.1 -> U1.14
]
DM = [
    ("F.Cu", [(42.25, 14.64), (42.25, 15.75), (41.25, 15.75), (41.25, 14.64)]),   # A7-B7 bridge
    ("F.Cu", [(41.25, 15.75), (40.25, 16.75), (37.0, 16.75), (36.4, 17.35),
              (35.537, 17.35)]),                                                     # -> U8.4
    ("F.Cu", [(35.537, 17.35), (33.263, 17.35)]),                                   # straight under U8 (4 -> 3)
    ("F.Cu", [(33.263, 17.35), (31.95, 17.35), (31.95, 19.1), (31.6, 19.45),
              (26.3, 19.45), (24.9, 20.85), (22.78, 20.85), (22.78, 20.2)]),        # U8.3 -> U1.13
]


# shell (S1, top-left slot) tied straight to the adjacent GND pads A1/B12
EXTRA = [("GND", "F.Cu", 0.3, [(37.68, 14.64), (38.8, 14.64)])]


def place(board):
    ox, oy = D.OFFSET
    for t in list(board.GetTracks()):
        if t.GetNetname() in ("USB_DP", "USB_DM"):
            board.Remove(t)
    for net, runs in (("USB_DP", DP), ("USB_DM", DM)):
        ni = board.FindNet(net)
        for layer, pts in runs:
            for a, b in zip(pts, pts[1:]):
                t = pcbnew.PCB_TRACK(board)
                t.SetStart(pcbnew.VECTOR2I(pcbnew.FromMM(a[0] + ox), pcbnew.FromMM(a[1] + oy)))
                t.SetEnd(pcbnew.VECTOR2I(pcbnew.FromMM(b[0] + ox), pcbnew.FromMM(b[1] + oy)))
                t.SetWidth(pcbnew.FromMM(W))
                t.SetLayer(board.GetLayerID(layer))
                t.SetNet(ni)
                t.SetLocked(True)
                board.Add(t)
    for net, layer, w, pts in EXTRA:
        for a, b in zip(pts, pts[1:]):
            t = pcbnew.PCB_TRACK(board)
            t.SetStart(pcbnew.VECTOR2I(pcbnew.FromMM(a[0] + ox), pcbnew.FromMM(a[1] + oy)))
            t.SetEnd(pcbnew.VECTOR2I(pcbnew.FromMM(b[0] + ox), pcbnew.FromMM(b[1] + oy)))
            t.SetWidth(pcbnew.FromMM(w))
            t.SetLayer(board.GetLayerID(layer))
            t.SetNet(board.FindNet(net))
            t.SetLocked(True)
            board.Add(t)


def lengths(board):
    """Signal path length J1 -> U1 per net (bridge stubs counted once)."""
    import math

    def plen(pts):
        return sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))
    # path through the connector uses the shorter pad of each pair + bridge half
    dp = sum(plen(r[1]) for r in DP[1:])
    dm = sum(plen(r[1]) for r in DM[1:])
    return dp, dm


VIA_CORRIDOR = 0.75   # mm from the pair centreline kept free of vias (In1 antipads)
BREAKOUT_X = 32.3     # connector + U8 breakout (CC/VBUS/GND pins sit between the
                      # lines and need vias): corridor covers the U8 -> ESP32 run only


def via_corridor(board):
    """Named areas along the pair; the .kicad_dru rule keeps other nets' vias
    out so none punches an antipad into the In1 plane under D+/D-."""
    import math
    ox, oy = D.OFFSET
    ls = pcbnew.LSET()
    for l in (pcbnew.F_Cu, pcbnew.In1_Cu, pcbnew.In2_Cu, pcbnew.B_Cu):
        ls.AddLayer(l)
    for runs in (DP, DM):
        for _, pts in runs[3:]:           # MCU-side run (U8.1/.3 -> U1)
            for a, b in zip(pts, pts[1:]):
                # clip the segment to x <= BREAKOUT_X
                if a[0] > BREAKOUT_X and b[0] > BREAKOUT_X:
                    continue
                if a[0] > BREAKOUT_X or b[0] > BREAKOUT_X:
                    (a, b) = (a, b) if a[0] <= BREAKOUT_X else (b, a)
                    t = (BREAKOUT_X - a[0]) / (b[0] - a[0])
                    b = (BREAKOUT_X, a[1] + (b[1] - a[1]) * t)
                L = math.dist(a, b)
                if L < 1e-6:
                    continue
                ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
                nx, ny = -uy, ux
                r = VIA_CORRIDOR
                quad = [(a[0] - ux * r + nx * r, a[1] - uy * r + ny * r),
                        (b[0] + ux * r + nx * r, b[1] + uy * r + ny * r),
                        (b[0] + ux * r - nx * r, b[1] + uy * r - ny * r),
                        (a[0] - ux * r - nx * r, a[1] - uy * r - ny * r)]
                z = pcbnew.ZONE(board)
                z.SetLayerSet(ls)
                o = z.Outline()
                o.NewOutline()
                for x, y in quad:
                    o.Append(pcbnew.FromMM(x + ox), pcbnew.FromMM(y + oy))
                # named area only; the restriction (non-GND vias) is the
                # custom rule "usb_reference_plane" in ai_glasses.kicad_dru
                z.SetIsRuleArea(True)
                z.SetDoNotAllowVias(False)
                z.SetDoNotAllowTracks(False)
                z.SetDoNotAllowCopperPour(False)
                z.SetDoNotAllowPads(False)
                z.SetDoNotAllowFootprints(False)
                z.SetZoneName("USB_VIA_KEEPOUT")
                board.Add(z)

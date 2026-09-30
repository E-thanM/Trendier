"""Amp supply rework (VSYS, source -> MAX98357A).

* C18 (100 nF) moved directly under U7's VDD pins 7/8, C17 (22 uF) beside it
* in the strip, B.Cu becomes a dedicated VSYS layer: 2 mm locked trunk plus a
  VSYS pour over the strip; the I2S lines re-route on In2 (under In1 GND)
* everything else on VSYS is re-routed at 0.6 mm (repair.py, WIDTH_OVERRIDE)
"""
import sys

import pcbnew

import design as D
import gen_pcb

MM = pcbnew.FromMM
TRUNK_W = 2.0
TRUNK = [(57.0, D.STRIP_MID), (96.2, D.STRIP_MID)]     # local mm, B.Cu
POUR = [(59.0, -1), (95.0, -1), (95.0, D.STRIP_Y1 + 1), (59.0, D.STRIP_Y1 + 1)]
NEW_POS = {"C18": (100.5, 7.75, 180, "F"), "C17": (100.5, 9.45, 180, "F")}
# hand-placed neck into U7's 0.25 mm VDD pins (7, 8), then full width to C18/C17
NECK = [(0.25, [(100.25, 6.44), (100.25, 6.98), (100.75, 6.98), (100.75, 6.44)]),   # pin7-pin8
        (0.3, [(100.75, 6.98), (100.98, 7.3), (100.98, 7.75)]),                       # -> C18 VSYS pad
        (0.6, [(100.98, 7.75), (101.45, 8.3), (101.45, 9.45)])]                       # -> C17 VSYS pad


def P(x, y):
    return pcbnew.VECTOR2I(MM(x + D.OFFSET[0]), MM(y + D.OFFSET[1]))


def main(path):
    b = pcbnew.LoadBoard(path)
    moved_pads = []
    for ref, (x, y, rot, side) in NEW_POS.items():
        fp = b.FindFootprintByReference(ref)
        moved_pads += [(p.GetPosition(), p.GetBoundingBox()) for p in fp.Pads()]
        fp.SetPosition(P(x, y))
        fp.SetOrientationDegrees(rot)
    # rip VSYS + AMP_DIN routing and any GND stub/via that served the old cap pads
    for t in list(b.GetTracks()):
        n = t.GetNetname()
        if n in ("VSYS", "AMP_DIN"):
            b.Remove(t)
        elif n == "GND":
            bb = t.GetBoundingBox()
            if any(pb.Intersects(bb) for _, pb in moved_pads):
                b.Remove(t)
    pcbnew.SaveBoard(path, b)


def add_trunk(path):
    # separate process step: KiCad 7's SWIG wrappers go stale after Remove()
    b = pcbnew.LoadBoard(path)
    vsys = b.FindNet("VSYS")
    gen_pcb.add_track(b, vsys, pcbnew.B_Cu, TRUNK[0], TRUNK[1], TRUNK_W)
    for w, pts in NECK:
        for p0, p1 in zip(pts, pts[1:]):
            gen_pcb.add_track(b, vsys, pcbnew.F_Cu, p0, p1, w)
    gen_pcb.add_zone(b, pcbnew.B_Cu, vsys, POUR, priority=2)
    pcbnew.SaveBoard(path, b)


if __name__ == "__main__":
    (add_trunk if "--trunk" in sys.argv else main)(sys.argv[1])

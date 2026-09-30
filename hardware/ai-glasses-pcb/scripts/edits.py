"""Targeted board edits (each step runs in its own process - see repair.py).

  outline   : replace Edge.Cuts with the filleted outline from gen_pcb
  micport   : enlarge U6's acoustic NPTH to 0.6 mm and keep In1/In2/B.Cu copper
              >= 0.5 mm away from it (F.Cu keeps the datasheet GND seal ring)
"""
import math
import sys

import pcbnew

import design as D
import gen_pcb

MM = pcbnew.FromMM
MIC_HOLE = 0.6
MIC_KEEPOUT_R = MIC_HOLE / 2 + 0.5


def outline_remove(path):
    b = pcbnew.LoadBoard(path)
    for d in list(b.GetDrawings()):
        if d.GetLayer() == pcbnew.Edge_Cuts:
            b.Remove(d)
    pcbnew.SaveBoard(path, b)


def outline_add(path):
    b = pcbnew.LoadBoard(path)
    gen_pcb.add_outline(b)
    pcbnew.SaveBoard(path, b)


def micport(path):
    b = pcbnew.LoadBoard(path)
    fp = b.FindFootprintByReference("U6")
    hole = [p for p in fp.Pads() if p.GetAttribute() == pcbnew.PAD_ATTRIB_NPTH][0]
    hole.SetDrillSize(pcbnew.VECTOR2I(MM(MIC_HOLE), MM(MIC_HOLE)))
    hole.SetSize(pcbnew.VECTOR2I(MM(MIC_HOLE), MM(MIC_HOLE)))
    c = hole.GetPosition()
    z = pcbnew.ZONE(b)
    ls = pcbnew.LSET()
    for l in (pcbnew.In1_Cu, pcbnew.In2_Cu, pcbnew.B_Cu):
        ls.AddLayer(l)
    z.SetLayerSet(ls)
    o = z.Outline()
    o.NewOutline()
    for i in range(24):
        a = 2 * math.pi * i / 24
        o.Append(c.x + MM(MIC_KEEPOUT_R * math.cos(a)), c.y + MM(MIC_KEEPOUT_R * math.sin(a)))
    z.SetIsRuleArea(True)
    z.SetDoNotAllowCopperPour(True)
    z.SetDoNotAllowTracks(True)
    z.SetDoNotAllowVias(True)
    z.SetDoNotAllowPads(False)
    z.SetDoNotAllowFootprints(False)
    z.SetZoneName("MIC_PORT_KEEPOUT")
    b.Add(z)
    pcbnew.SaveBoard(path, b)


def silk(path):
    """Battery polarity marks next to J3 (bottom side)."""
    b = pcbnew.LoadBoard(path)
    fp = b.FindFootprintByReference("J3")
    pads = {p.GetNumber(): p.GetPosition() for p in fp.Pads() if p.GetNumber() in ("1", "2")}
    for num, txt in (("1", "+"), ("2", "-")):
        t = pcbnew.PCB_TEXT(b)
        t.SetText(txt)
        t.SetLayer(pcbnew.B_SilkS)
        t.SetPosition(pcbnew.VECTOR2I(pads[num].x, pads[num].y - MM(1.55)))
        t.SetTextSize(pcbnew.VECTOR2I(MM(0.8), MM(0.8)))
        t.SetTextThickness(MM(0.15))
        t.SetMirrored(True)
        b.Add(t)
    pcbnew.SaveBoard(path, b)


if __name__ == "__main__":
    step, path = sys.argv[1], sys.argv[2]
    {"outline_remove": outline_remove, "outline_add": outline_add, "micport": micport,
     "silk": silk}[step](path)

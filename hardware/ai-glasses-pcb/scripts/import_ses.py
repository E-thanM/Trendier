"""Import a Freerouting .ses session into a board (KiCad 7's
ImportSpecctraSES needs the GUI, so this does it with the pcbnew API)."""
import re
import sys

import pcbnew
import sexpdata

from kicadlib import child, children, tag


def import_ses(board, ses_path, clear_existing=True):
    data = sexpdata.loads(open(ses_path).read())
    routes = child(data, "routes")
    res = child(routes, "resolution")
    unit, per = str(res[1]), float(res[2])
    scale_nm = {"um": 1000.0, "mm": 1e6, "mil": 25400.0}[unit] / per

    def pt(x, y):
        return pcbnew.VECTOR2I(int(round(float(x) * scale_nm)),
                               int(round(-float(y) * scale_nm)))

    padstacks = {}
    lib = child(routes, "library_out")
    for ps in children(lib, "padstack") if lib else []:
        name = ps[1]
        m = re.search(r"_(\d+):(\d+)_um", name)
        padstacks[name] = (int(m.group(1)) * 1000, int(m.group(2)) * 1000)

    # Locked items (GND fan-out, VSYS trunk) are exported as "fix" wiring,
    # which Freerouting leaves out of the session - keep them, drop the rest.
    keep = set()
    for t in list(board.GetTracks()):
        if t.IsLocked():
            if isinstance(t, pcbnew.PCB_VIA):
                p = t.GetPosition()
                keep.add(("v", p.x // 1000, p.y // 1000))
            else:
                a, b = t.GetStart(), t.GetEnd()
                keep.add(("t", t.GetLayer(), a.x // 1000, a.y // 1000, b.x // 1000, b.y // 1000))
                keep.add(("t", t.GetLayer(), b.x // 1000, b.y // 1000, a.x // 1000, a.y // 1000))
        elif clear_existing:
            board.Remove(t)

    ntrk = nvia = 0
    for net in children(child(routes, "network_out"), "net"):
        name = net[1] if isinstance(net[1], str) else str(net[1])
        ni = board.FindNet(name)
        if ni is None:
            sys.exit("unknown net in session: " + name)
        for w in children(net, "wire"):
            path = child(w, "path")
            layer = board.GetLayerID(str(path[1]))
            width = int(round(float(path[2]) * scale_nm))
            coords = path[3:]
            raw = [pt(coords[i], coords[i + 1]) for i in range(0, len(coords) - 1, 2)]
            # drop near-duplicate points (Freerouting sometimes emits 1 um
            # jogs that it cannot re-normalise on a later pass)
            pts = [raw[0]]
            for q in raw[1:]:
                if abs(q.x - pts[-1].x) > 5000 or abs(q.y - pts[-1].y) > 5000:
                    pts.append(q)
            if len(pts) == 1 and len(raw) > 1:
                pts.append(raw[-1])
            for a, b in zip(pts, pts[1:]):
                if a == b or ("t", layer, a.x // 1000, a.y // 1000, b.x // 1000,
                              b.y // 1000) in keep:
                    continue
                t = pcbnew.PCB_TRACK(board)
                t.SetStart(a)
                t.SetEnd(b)
                t.SetWidth(width)
                t.SetLayer(layer)
                t.SetNet(ni)
                board.Add(t)
                ntrk += 1
        for v in children(net, "via"):
            dia, drill = padstacks[v[1]]
            pos = pt(v[2], v[3])
            if ("v", pos.x // 1000, pos.y // 1000) in keep:
                continue
            via = pcbnew.PCB_VIA(board)
            via.SetPosition(pos)
            via.SetWidth(dia)
            via.SetDrill(drill)
            via.SetViaType(pcbnew.VIATYPE_THROUGH)
            via.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu)
            via.SetNet(ni)
            board.Add(via)
            nvia += 1
    return ntrk, nvia


if __name__ == "__main__":
    b = pcbnew.LoadBoard(sys.argv[1])
    print(import_ses(b, sys.argv[2]))
    pcbnew.SaveBoard(sys.argv[3] if len(sys.argv) > 3 else sys.argv[1], b)

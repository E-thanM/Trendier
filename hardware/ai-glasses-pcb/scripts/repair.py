"""Rip up whatever collides with new fixed (locked) copper and re-route it.

    python3 repair.py board.kicad_pcb

Loop: DRC -> for every clearance/short error involving a locked item, remove
the unlocked colliding items (whole net for signals, just the item for GND)
-> A* re-route of the affected signal nets (patch_route) -> GND fan-out for
GND pads that lost their via -> repeat until DRC is clean or no progress.
Each step runs in a fresh process (KiCad 7's python API does not like
reloading boards in one interpreter).
"""
import json
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))


def run(code, *args):
    r = subprocess.run([sys.executable, "-c", code, *args], cwd=HERE,
                       capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(r.stdout + r.stderr)
    # SWIG may print "memory leak" notices after our JSON line
    for line in reversed(r.stdout.splitlines()):
        try:
            json.loads(line)
            return line
        except ValueError:
            continue
    raise SystemExit("no JSON result from helper:\n" + r.stdout + r.stderr)


DRC = r'''
import sys, re, json, pcbnew
p = sys.argv[1]
b = pcbnew.LoadBoard(p)
pcbnew.ZONE_FILLER(b).Fill(b.Zones())
rpt = p + ".rpt"
pcbnew.WriteDRCReport(b, rpt, pcbnew.EDA_UNITS_MILLIMETRES, True)
t = open(rpt).read()
errs = []
for blk in re.split(r"\n(?=\[)", t):
    m = re.match(r"\[(\w+)\]", blk)
    if not m or "Severity: error" not in blk:
        continue
    items = re.findall(r"@\(([\d.]+) mm, ([\d.]+) mm\): (\w[\w ]*?) \[([^\]]*)\]", blk)
    errs.append((m.group(1), items))
unc = int(re.search(r"Found (\d+) unconnected", t).group(1))
print(json.dumps({"errors": errs, "unconnected": unc}))
'''

RIP = r'''
import sys, json, pcbnew
from fanout import to_mm, seg_dist
p = sys.argv[1]; errs = json.loads(sys.argv[2])
b = pcbnew.LoadBoard(p)
rip_nets, rip_items = set(), []
for kind, items in errs:
    if kind not in ("clearance", "shorting_items", "hole_clearance", "tracks_crossing",
                    "hole_near_hole", "copper_edge_clearance", "solder_mask_bridge",
                    "items_not_allowed"):
        continue
    for x, y, what, net in items:
        x, y = float(x), float(y)
        for t in b.GetTracks():
            if t.IsLocked() and net not in ("GND",):
                pass
            if t.GetNetname() != net:
                continue
            if isinstance(t, pcbnew.PCB_VIA):
                hit = abs(t.GetPosition().x / 1e6 - x) < 1e-3 and abs(t.GetPosition().y / 1e6 - y) < 1e-3
            else:
                s, e = to_mm(t.GetStart()), to_mm(t.GetEnd())
                hit = seg_dist(x, y, *s, *e) < 1e-3
            if not hit:
                continue
            if t.IsLocked() and net not in ("GND",) and not (kind == "copper_edge_clearance"):
                continue          # never rip the new fixed copper
            if net == "GND":
                rip_items.append(t)
            else:
                rip_nets.add(net)
for t in rip_items:
    b.Remove(t)
for t in list(b.GetTracks()):
    if t.GetNetname() in rip_nets and not t.IsLocked():
        b.Remove(t)
pcbnew.SaveBoard(p, b)
print(json.dumps(sorted(rip_nets)))
'''

ROUTE = r'''
import sys, json, os, pcbnew, patch_route
p = sys.argv[1]; nets = json.loads(sys.argv[2])
patch_route.WIDTH_OVERRIDE.update(json.loads(os.environ.get("WIDTH_OVERRIDE", "{}")))
b = pcbnew.LoadBoard(p)
res = patch_route.patch(b, nets)
pcbnew.SaveBoard(p, b)
print(json.dumps(res))
'''

UNCONNECTED = r'''
import sys, json, pcbnew, build
p = sys.argv[1]
b = pcbnew.LoadBoard(p)
pcbnew.ZONE_FILLER(b).Fill(b.Zones())
print(json.dumps(sorted({(q.GetNetname()) for q in build.unconnected_pads(b)})))
'''

GNDFIX = r'''
import sys, json, pcbnew, build, fanout
p = sys.argv[1]
b = pcbnew.LoadBoard(p)
pcbnew.ZONE_FILLER(b).Fill(b.Zones())
og = [q for q in build.unconnected_pads(b) if q.GetNetname() == "GND"]
res = fanout.fanout(b, only={build.key(q) for q in og}) if og else (0, [])
pcbnew.SaveBoard(p, b)
print(json.dumps(res))
'''


def repair(path, rounds=6):
    for i in range(rounds):
        d = json.loads(run(DRC, path))
        print(f"round {i}: {len(d['errors'])} DRC errors, {d['unconnected']} unconnected")
        if not d["errors"] and not d["unconnected"]:
            return True
        nets = json.loads(run(RIP, path, json.dumps(d["errors"])))
        open_nets = json.loads(run(UNCONNECTED, path))
        sig = sorted(set(nets) | {n for n in open_nets if n != "GND"})
        if sig:
            print("  re-routing:", sig, "->", run(ROUTE, path, json.dumps(sig)))
        if "GND" in json.loads(run(UNCONNECTED, path)):
            print("  GND fan-out:", run(GNDFIX, path))
    d = json.loads(run(DRC, path))
    print(f"final: {len(d['errors'])} DRC errors, {d['unconnected']} unconnected")
    return not d["errors"] and not d["unconnected"]


if __name__ == "__main__":
    sys.exit(0 if repair(sys.argv[1]) else 1)

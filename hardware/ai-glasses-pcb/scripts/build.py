"""Full board build: place -> GND fan-out -> autoroute -> pours -> DRC.

    python3 build.py            # uses Freerouting (downloaded on first run)

Requires KiCad 7+ (pcbnew python module), Java 17+ and, on a headless
machine, xvfb-run.
"""
import math
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request

import pcbnew

import design as D
import fanout
import gen_pcb
import import_ses
import stitch
import patch_route
import finish

MM = pcbnew.FromMM
FR_URL = ("https://github.com/freerouting/freerouting/releases/download/"
          "v1.9.0/freerouting-1.9.0.jar")
FR_JAR = os.path.expanduser("~/.cache/freerouting/freerouting-1.9.0.jar")
EDGE_BAND = 0.4   # extra keep-out inside the outline for the router only


def freerouting_jar():
    if not os.path.exists(FR_JAR):
        os.makedirs(os.path.dirname(FR_JAR), exist_ok=True)
        print("downloading", FR_URL)
        urllib.request.urlretrieve(FR_URL, FR_JAR)
    return FR_JAR


def edge_band_keepouts(board):
    """Thin track/via keep-outs along every edge so routed copper stays
    >= 0.5 mm from the board edge (the router only knows one clearance)."""
    edges = fanout.board_edges(board)
    ls = pcbnew.LSET()
    for l in gen_pcb.ALL_CU:
        ls.AddLayer(l)
    for ax, ay, bx, by in edges:
        L = math.hypot(bx - ax, by - ay)
        if L < 1e-6:
            continue
        nx, ny = -(by - ay) / L, (bx - ax) / L
        mx, my = (ax + bx) / 2, (ay + by) / 2
        if not fanout.point_in_board(mx + nx * 0.05, my + ny * 0.05, edges):
            nx, ny = -nx, -ny
        z = pcbnew.ZONE(board)
        z.SetLayerSet(ls)
        o = z.Outline()
        o.NewOutline()
        ext = 0.05   # overlap neighbours so corners are covered
        ux, uy = (bx - ax) / L, (by - ay) / L
        for px, py in [(ax - ux * ext - nx * 0.1, ay - uy * ext - ny * 0.1),
                       (bx + ux * ext - nx * 0.1, by + uy * ext - ny * 0.1),
                       (bx + ux * ext + nx * EDGE_BAND, by + uy * ext + ny * EDGE_BAND),
                       (ax - ux * ext + nx * EDGE_BAND, ay - uy * ext + ny * EDGE_BAND)]:
            o.Append(MM(px), MM(py))
        z.SetIsRuleArea(True)
        z.SetDoNotAllowTracks(True)
        z.SetDoNotAllowVias(True)
        z.SetDoNotAllowCopperPour(False)
        z.SetDoNotAllowPads(False)
        z.SetDoNotAllowFootprints(False)
        board.Add(z)


def add_pours(board):
    gnd = board.FindNet("GND")
    for layer in (pcbnew.F_Cu, pcbnew.In2_Cu, pcbnew.B_Cu):
        gen_pcb.add_zone(board, layer, gnd, gen_pcb.BIG, priority=0)


def route(board_path, passes=40):
    tmp = tempfile.mkdtemp(prefix="route_")
    b = pcbnew.LoadBoard(board_path)
    edge_band_keepouts(b)
    dsn = os.path.join(tmp, "board.dsn")
    ses = os.path.join(tmp, "board.ses")
    assert pcbnew.ExportSpecctraDSN(b, dsn)
    cmd = ["java", "-jar", freerouting_jar(), "-de", dsn, "-do", ses,
           "-mp", str(passes)]
    if not os.environ.get("DISPLAY") and shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a"] + cmd
    log = open(os.path.join(tmp, "freerouting.log"), "w")
    proc = subprocess.Popen(cmd, stdout=log, stderr=subprocess.STDOUT,
                            start_new_session=True)
    try:
        proc.wait(timeout=600)
    except subprocess.TimeoutExpired:
        import signal
        os.killpg(proc.pid, signal.SIGKILL)
        proc.wait()
        print("    freerouting hung - skipping this attempt")
        return None, tmp
    return (ses if os.path.exists(ses) else None), tmp


def key(pad):
    return (pad.GetParent().GetReference(), pad.GetNumber())


def unconnected_pads(board):
    """Pads named in DRC 'unconnected_items' entries (the connectivity API
    segfaults when driven from python in KiCad 7, the DRC report doesn't)."""
    import re
    rpt = os.path.join(tempfile.mkdtemp(), "u.rpt")
    pcbnew.WriteDRCReport(board, rpt, pcbnew.EDA_UNITS_MILLIMETRES, True)
    txt = open(rpt).read()
    want = set()
    for block in txt.split("[unconnected_items]")[1:]:
        for m in re.finditer(r"Pad (\S+) \[([^\]]*)\] of (\S+)", block.split("\n[")[0]):
            want.add((m.group(3), m.group(1)))
    return [p for p in board.GetPads() if key(p) in want]


def label(pads):
    return sorted(f"{p.GetParent().GetReference()}.{p.GetNumber()}[{p.GetNetname()}]"
                  for p in pads)


def place_and_route(passes):
    path = gen_pcb.build()
    b = pcbnew.LoadBoard(path)
    placed, failed = fanout.fanout(b)
    print(f"GND fan-out: {placed} stubs/vias, left to router: {failed}")
    pcbnew.SaveBoard(path, b)
    open_sig = None
    # autoroute; if signals remain open, continue routing from the result
    for attempt in range(3):
        ses, tmp = route(path, passes=passes)
        if ses is None:
            if open_sig is None:
                open_sig = ["(router failed)"] * 999
            break
        b = pcbnew.LoadBoard(path)
        ntrk, nvia = import_ses.import_ses(b, ses, clear_existing=True)
        print(f"  route pass {attempt}: {ntrk} segments, {nvia} vias")
        pcbnew.SaveBoard(path, b)
        shutil.copy(ses, os.path.join(os.path.dirname(path), "ai_glasses.ses"))
        b = pcbnew.LoadBoard(path)
        pcbnew.ZONE_FILLER(b).Fill(b.Zones())
        open_sig = [p for p in unconnected_pads(b) if p.GetNetname() != "GND"]
        print("    open signal pads:", label(open_sig))
        if not open_sig:
            break
    return path, open_sig


def main():
    best = None
    # Freerouting is deterministic for a given input; different pass budgets
    # give different results, so try a few and keep the first complete one.
    for passes in (80, 60, 100, 70, 90, 50, 110, 120, 140):
        print(f"== autorouting with {passes} passes")
        path, open_sig = place_and_route(passes)
        if open_sig and open_sig[0] == "(router failed)":
            continue
        if best is None or len(open_sig) < best[0]:
            best = (len(open_sig), passes)
            shutil.copy(path, path + ".best")
        if not open_sig:
            break
    shutil.move(path + ".best", path)
    print("using result from", best[1], "passes; open signal pads:", best[0])
    if best[0]:
        b = pcbnew.LoadBoard(path)
        pcbnew.ZONE_FILLER(b).Fill(b.Zones())
        nets = sorted({p.GetNetname() for p in unconnected_pads(b) if p.GetNetname() != "GND"})
        b = pcbnew.LoadBoard(path)
        print("fallback router:", patch_route.patch(b, nets))
        pcbnew.SaveBoard(path, b)

    # 2) ground pours on L1/L3/L4 + stitching + fix-up of left-over GND pads
    b = pcbnew.LoadBoard(path)
    print("silk items trimmed:", finish.trim_silk(b))
    add_pours(b)
    print("stitching vias:", stitch.stitch(b))
    pcbnew.ZONE_FILLER(b).Fill(b.Zones())
    open_gnd = [p for p in unconnected_pads(b) if p.GetNetname() == "GND"]
    if open_gnd:
        print("post-route GND fan-out for", label(open_gnd), "->",
              fanout.fanout(b, only={key(p) for p in open_gnd}))
        pcbnew.ZONE_FILLER(b).Fill(b.Zones())
    print("dangling vias removed:", finish.remove_dangling_vias(b))
    pcbnew.ZONE_FILLER(b).Fill(b.Zones())
    pcbnew.SaveBoard(path, b)
    print("still open:", label(unconnected_pads(pcbnew.LoadBoard(path))))
    return path


if __name__ == "__main__":
    print(main())

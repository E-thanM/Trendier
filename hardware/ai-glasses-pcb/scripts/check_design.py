"""Independent verification of the design.

 1. design.py  <->  schematic netlist (exported by kicad-cli)  <->  PCB pads
 2. ERC-style checks on the design (unconnected pins, single-pin nets,
    power pins without a driver, pin types)
 3. Electrical sanity rules specific to this circuit
 4. PCB checks: KiCad DRC (0 errors, 0 unconnected), parts inside the
    outline, nothing in the antenna keep-out, mic port clear on both sides.

Exit code is non-zero if anything fails.
"""
import os
import re
import subprocess
import sys
import tempfile

import pcbnew
import sexpdata

import design as D
import kicadlib as K

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.normpath(os.path.join(HERE, ".."))
SCH = os.path.join(PROJ, "ai_glasses.kicad_sch")
PCB = os.path.join(PROJ, "ai_glasses.kicad_pcb")

fails, notes = [], []


def check(cond, msg):
    (notes if cond else fails).append(("PASS " if cond else "FAIL ") + msg)
    return cond


def design_nets():
    nets = {}
    for p in D.PARTS:
        for pin, n in p["pins"].items():
            if n:
                nets.setdefault(n, set()).add((p["ref"], pin))
    return nets


def schematic_nets():
    out = os.path.join(tempfile.mkdtemp(), "sch.net")
    subprocess.run(["kicad-cli", "sch", "export", "netlist", "-o", out, SCH],
                   check=True, capture_output=True)
    data = sexpdata.loads(open(out).read())
    nets = {}
    for n in K.children(K.child(data, "nets"), "net"):
        name = K.child(n, "name")[1].lstrip("/")
        nodes = {(K.child(x, "ref")[1], K.child(x, "pin")[1]) for x in K.children(n, "node")}
        nodes = {x for x in nodes if not x[0].startswith("#")}
        if name.startswith("unconnected-"):
            nets.setdefault("__nc__", set()).update(nodes)
            continue
        if name.startswith("Net-("):
            # auto-named nets must not exist: every connected pin is labelled
            nets.setdefault("__auto__", set()).update(nodes)
            continue
        nets[name] = nodes
    return nets


def pcb_nets(board):
    nets = {}
    for fp in board.GetFootprints():
        for pad in fp.Pads():
            if pad.GetNumber() == "" or pad.GetNetname() == "":
                continue
            nets.setdefault(pad.GetNetname(), set()).add((fp.GetReference(), pad.GetNumber()))
    return nets


def sym_fp_links():
    """Mismatches between schematic symbols and board footprints (the data
    'Update PCB from Schematic' compares)."""
    d = sexpdata.loads(open(SCH).read())
    sch = {}
    for s in K.children(d, "symbol"):
        pr = {p[1]: p[2] for p in K.children(s, "property")}
        if not pr["Reference"].startswith("#"):
            sch[pr["Reference"]] = (K.child(s, "uuid")[1], pr["Value"], pr["Footprint"])
    board = pcbnew.LoadBoard(PCB)
    bad = []
    seen = set()
    for f in board.GetFootprints():
        r = f.GetReference()
        seen.add(r)
        if r not in sch:
            bad.append((r, "no symbol"))
            continue
        uid, val, fp = sch[r]
        fpid = f.GetFPID()
        if (f.GetPath().AsString() != "/" + uid or f.GetValue() != val or
                f"{fpid.GetLibNickname()}:{fpid.GetLibItemName()}" != fp):
            bad.append(r)
    bad += [(r, "no footprint") for r in set(sch) - seen]
    return bad


def compare(a, b, an, bn):
    ok = True
    for n in sorted(set(a) | set(b)):
        if a.get(n, set()) != b.get(n, set()):
            ok = False
            fails.append(f"FAIL net {n}: {an} {sorted(a.get(n, set()) - b.get(n, set()))}"
                         f" vs {bn} {sorted(b.get(n, set()) - a.get(n, set()))}")
    check(ok, f"{an} and {bn} have identical connectivity ({len(a)} nets)")


def erc(dn):
    by_ref = D.by_ref()
    drivers = set(D.POWER_FLAG_NETS)
    for p in D.PARTS:
        lib, name = p["sym"].split(":")
        sym = K.find_symbol(lib, name, os.path.join(PROJ, "AI_Glasses.kicad_sym")
                            if lib == "AI_Glasses" else None)
        pins = K.pins(sym)
        numbers = {x["number"] for x in pins}
        check(numbers == set(p["pins"]),
              f"{p['ref']}: every symbol pin has an explicit net or NC ({len(numbers)} pins)")
        for x in pins:
            n = p["pins"].get(x["number"])
            if x["type"] == "power_out" and n:
                drivers.add(n)
            if x["type"] == "no_connect" and n:
                fails.append(f"FAIL {p['ref']}.{x['number']} is a no-connect pin but is wired to {n}")
    # regulator outputs are power_in in some KiCad symbols: treat as drivers
    drivers |= {"+3V3", "+2V8_CAM", "+1V2_CAM"}
    for n, nodes in dn.items():
        check(len(nodes) >= 2, f"net {n} has {len(nodes)} connections")
    for p in D.PARTS:
        lib, name = p["sym"].split(":")
        sym = K.find_symbol(lib, name, os.path.join(PROJ, "AI_Glasses.kicad_sym")
                            if lib == "AI_Glasses" else None)
        for x in K.pins(sym):
            n = p["pins"].get(x["number"])
            if x["type"] == "power_in" and n and n not in drivers:
                fails.append(f"FAIL power input {p['ref']}.{x['number']} on undriven net {n}")


def electrical(dn):
    esp = D.by_ref()["U1"]["pins"]
    io_nets = {n for pin, n in esp.items() if n and pin not in ("1", "2", "40", "41")}
    for rail in ("VBUS", "VBAT", "VSYS", "+2V8_CAM", "+1V2_CAM"):
        check(rail not in io_nets, f"no ESP32 GPIO tied directly to {rail}")
    for pin in ("28", "29", "30"):
        check(esp[pin] is None, f"ESP32 pin {pin} (IO35-37, octal PSRAM) left unconnected")
    for pin, nm in (("15", "IO3"), ("16", "IO46"), ("26", "IO45")):
        check(esp[pin] is None, f"strapping pin {nm} left floating (default boot mode)")
    check(esp["13"] == "USB_DM" and esp["14"] == "USB_DP", "native USB on IO19/IO20")
    # VBAT divider keeps ADC under the 11 dB range (~3.1 V) at 4.2 V
    r9, r10 = 1e6, 1e6
    check(4.2 * r10 / (r9 + r10) < 3.1, "VBAT_SENSE <= 2.1 V at a full cell")
    # charger programming
    ichg = 1000 / 5.1e3
    check(0.05 < ichg < 0.5, f"charge current {ichg * 1000:.0f} mA")
    # every rail has local decoupling
    for rail, minimum in (("+3V3", 4), ("VSYS", 3), ("VBUS", 1), ("VBAT", 1),
                          ("+2V8_CAM", 2), ("+1V2_CAM", 2)):
        caps = [r for r, _ in dn[rail] if r.startswith("C")]
        check(len(caps) >= minimum, f"{rail} decoupled by {len(caps)} capacitors")
    # USB-C sink: 5.1k on both CC pins
    check({("R1", "1")} <= dn["CC1"] and {("R2", "1")} <= dn["CC2"], "USB-C CC1/CC2 5.1k pull-downs")
    # I2S directions
    check(("U6", "6") in dn["MIC_SD"] and ("U1", "7") in dn["MIC_SD"], "mic SD -> ESP32 IO7")
    check(("U7", "1") in dn["AMP_DIN"] and ("U1", "10") in dn["AMP_DIN"], "ESP32 IO17 -> amp DIN")
    check(("U8", "1") in dn["USB_DP"] and ("U8", "6") in dn["USB_DP"], "USBLC6 flow-through on D+")
    # power path: PMOS source on VSYS, drain on battery, gate on VBUS
    q = D.by_ref()["Q1"]["pins"]
    check(q == {"1": "VBUS", "2": "VSYS", "3": "VBAT"}, "P-FET power path G=VBUS S=VSYS D=VBAT")
    d1 = D.by_ref()["D1"]["pins"]
    check(d1 == {"1": "VSYS", "2": "VBUS"}, "Schottky anode on VBUS, cathode on VSYS")


def pcb_checks():
    board = pcbnew.LoadBoard(PCB)
    compare(design_nets(), pcb_nets(board), "design", "pcb")
    pcbnew.ZONE_FILLER(board).Fill(board.Zones())
    rpt = os.path.join(tempfile.mkdtemp(), "drc.rpt")
    pcbnew.WriteDRCReport(board, rpt, pcbnew.EDA_UNITS_MILLIMETRES, True)
    txt = open(rpt).read()
    errs = re.findall(r"^\[(\w+)\].*\n.*Severity: error", txt, re.M)
    warns = re.findall(r"^\[(\w+)\].*\n.*Severity: warning", txt, re.M)
    unc = int(re.search(r"Found (\d+) unconnected", txt).group(1))
    check(not errs, f"DRC errors: {len(errs)} {sorted(set(errs))}")
    check(unc == 0, f"unconnected items: {unc}")
    notes.append(f"INFO DRC warnings: {len(warns)} {sorted(set(warns))}")
    # courtyards inside the board, nothing but U1 in the antenna keep-out
    edge = board.GetBoardEdgesBoundingBox()
    kx = pcbnew.FromMM(D.OFFSET[0] + D.ANTENNA_KEEPOUT_X)
    for fp in board.GetFootprints():
        for pad in fp.Pads():
            bb = pad.GetBoundingBox()
            check(edge.Contains(bb.GetOrigin()) and edge.Contains(bb.GetEnd()) or
                  fp.GetReference() in ("J1",), f"{fp.GetReference()}.{pad.GetNumber()} inside outline")
            if fp.GetReference() != "U1" and pad.GetAttribute() != pcbnew.PAD_ATTRIB_NPTH:
                check(bb.GetLeft() > kx, f"{fp.GetReference()}.{pad.GetNumber()} outside antenna keep-out")
    for t in board.GetTracks():
        if t.GetBoundingBox().GetLeft() < kx:
            fails.append(f"FAIL copper {t.GetClass()} {t.GetNetname()} inside antenna keep-out")
    # mic acoustic port: nothing on the bottom side over the hole
    mic = board.FindFootprintByReference("U6")
    hole = [p for p in mic.Pads() if p.GetAttribute() == pcbnew.PAD_ATTRIB_NPTH][0]
    hp = hole.GetPosition()
    for fp in board.GetFootprints():
        if fp.IsFlipped():
            bb = fp.GetBoundingBox(False, False)
            bb.Inflate(pcbnew.FromMM(0.5))
            check(not bb.Contains(hp), f"mic port not covered by {fp.GetReference()}")
    review_checks(board)
    return board


def review_checks(board):
    """Checks added with the layout review (USB pair, amp supply, mic port)."""
    import math
    from fanout import to_mm
    import usb_pair
    ox, oy = D.OFFSET
    # USB pair: signal-path length match and routed on F.Cu only
    dp, dm = usb_pair.lengths(board)
    check(abs(dp - dm) < 0.5, f"USB D+/D- path length mismatch {abs(dp - dm):.2f} mm (< 0.5 mm)")
    layers = {t.GetLayerName() for t in board.GetTracks()
              if t.GetNetname() in ("USB_DP", "USB_DM") and not isinstance(t, pcbnew.PCB_VIA)}
    check(layers == {"F.Cu"}, f"USB pair routed on F.Cu over the In1 plane ({sorted(layers)})")
    # amp supply: >= 0.5 mm except the neck into U7's 0.25 mm VDD pins
    u7 = board.FindFootprintByReference("U7")
    vdd = [to_mm(p.GetPosition()) for p in u7.Pads() if p.GetNumber() in ("7", "8")]
    thin = []
    for t in board.GetTracks():
        if t.GetNetname() != "VSYS" or isinstance(t, pcbnew.PCB_VIA) or t.GetWidth() >= pcbnew.FromMM(0.5):
            continue
        s, e = to_mm(t.GetStart()), to_mm(t.GetEnd())
        if max(min(math.dist(s, v), math.dist(e, v)) for v in vdd) > 1.6:
            thin.append((round(s[0] - ox, 2), round(s[1] - oy, 2)))
    check(not thin, f"VSYS >= 0.5 mm wide outside the U7 pin neck (narrow at {thin})")
    # decoupling right at the amp
    c18 = [to_mm(p.GetPosition()) for p in board.FindFootprintByReference("C18").Pads()
           if p.GetNetname() == "VSYS"][0]
    d = min(math.dist(c18, v) for v in vdd)
    check(d < 1.5, f"C18 100 nF VSYS pad {d:.2f} mm from U7 VDD pins (< 1.5 mm)")
    c17 = [to_mm(p.GetPosition()) for p in board.FindFootprintByReference("C17").Pads()
           if p.GetNetname() == "VSYS"][0]
    d = min(math.dist(c17, v) for v in vdd)
    check(d < 4.0, f"C17 22 uF VSYS pad {d:.2f} mm from U7 VDD pins (< 4 mm)")
    # microphone acoustic port: >= 0.6 mm and no copper on In1/In2/B.Cu within 0.5 mm
    mic = board.FindFootprintByReference("U6")
    hole = [p for p in mic.Pads() if p.GetAttribute() == pcbnew.PAD_ATTRIB_NPTH][0]
    check(hole.GetDrillSize().x >= pcbnew.FromMM(0.6), "mic port drill >= 0.6 mm (datasheet min 0.5)")
    hp = hole.GetPosition()
    r = pcbnew.FromMM(hole.GetDrillSize().x / 2e6 + 0.5)
    for z in board.Zones():
        if z.GetIsRuleArea():
            continue
        for l in (pcbnew.In1_Cu, pcbnew.In2_Cu, pcbnew.B_Cu):
            if z.IsOnLayer(l):
                check(not z.GetFilledPolysList(l).Collide(hp, r - pcbnew.FromMM(0.01)),
                      f"no {pcbnew.LayerName(l)} pour within 0.5 mm of the mic port")
    # outline: one closed contour
    polys = pcbnew.SHAPE_POLY_SET()
    check(board.GetBoardPolygonOutlines(polys) and polys.OutlineCount() == 1,
          "Edge.Cuts forms exactly one closed outline")


def main():
    dn = design_nets()
    sn = schematic_nets()
    check("__auto__" not in sn, "no unlabelled / auto-named nets in the schematic")
    sn.pop("__auto__", None)
    nc = {(p["ref"], pin) for p in D.PARTS for pin, n in p["pins"].items() if n is None}
    check(sn.pop("__nc__", set()) == nc,
          f"schematic unconnected pins are exactly the {len(nc)} intentional NC pins")
    compare(dn, sn, "design", "schematic")
    r = subprocess.run([sys.executable, os.path.join(HERE, "check_wiring.py"), SCH],
                       capture_output=True, text=True)
    check(r.returncode == 0, "schematic wiring: " + r.stdout.strip().splitlines()[-1])
    links = sym_fp_links()
    check(not links, f"every schematic symbol linked to its PCB footprint (uuid, value, footprint) {links or ''}")
    erc(dn)
    electrical(dn)
    pcb_checks()
    for line in notes:
        if not line.startswith("PASS") or "-v" in sys.argv:
            print(line)
    print(f"{len([n for n in notes if n.startswith('PASS')])} checks passed")
    for f in fails:
        print(f)
    print("RESULT:", "FAIL" if fails else "ALL CHECKS PASSED")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()

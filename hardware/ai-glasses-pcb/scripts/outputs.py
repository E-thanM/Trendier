"""Fabrication outputs: BOM (CSV), Gerbers + drill, pick-and-place, PDFs."""
import csv
import os
import subprocess

import design as D

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.normpath(os.path.join(HERE, ".."))
PCB = os.path.join(PROJ, "ai_glasses.kicad_pcb")
SCH = os.path.join(PROJ, "ai_glasses.kicad_sch")
FAB = os.path.join(PROJ, "fab")

GENERIC = {
    "Device:R": "Yageo RC0402FR-07 series (1%, 1/16 W)",
    "Device:C": "X5R/X7R MLCC, >= 10 V",
    "Device:LED": "0603 LED",
    "Connector:TestPoint": "(bare pad - not assembled)",
}


def bom():
    groups = {}
    for p in D.PARTS:
        key = (p["value"], p["fp"], p["mpn"] or GENERIC.get(p["sym"], ""))
        groups.setdefault(key, []).append(p["ref"])
    path = os.path.join(FAB, "ai_glasses-BOM.csv")
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Qty", "References", "Value", "Footprint", "Part / MPN", "Side", "Notes"])
        for (value, fp, mpn), refs in sorted(groups.items(), key=lambda kv: kv[1][0]):
            refs.sort(key=lambda r: (r.rstrip("0123456789"), int(r[len(r.rstrip("0123456789")):] or 0)))
            sides = sorted({D.by_ref()[r]["pos"][3] for r in refs})
            desc = D.by_ref()[refs[0]]["desc"]
            w.writerow([len(refs), " ".join(refs), value, fp.split(":")[1], mpn,
                        "/".join("Top" if s == "F" else "Bottom" for s in sides), desc])
    return path


def run(*args):
    subprocess.run(["kicad-cli", *args], check=True, capture_output=True)


def fab():
    os.makedirs(FAB, exist_ok=True)
    g = os.path.join(FAB, "gerbers")
    os.makedirs(g, exist_ok=True)
    layers = ("F.Cu,In1.Cu,In2.Cu,B.Cu,F.Paste,B.Paste,F.Silkscreen,B.Silkscreen,"
              "F.Mask,B.Mask,Edge.Cuts")
    run("pcb", "export", "gerbers", "--subtract-soldermask", "-l", layers, "-o", g + "/", PCB)
    run("pcb", "export", "drill", "--format", "excellon", "--excellon-separate-th",
        "--generate-map", "--map-format", "pdf", "-o", g + "/", PCB)
    run("pcb", "export", "pos", "--format", "csv", "--units", "mm", "--side", "both",
        "-o", os.path.join(FAB, "ai_glasses-pos.csv"), PCB)
    run("sch", "export", "pdf", "-o", os.path.join(FAB, "ai_glasses-schematic.pdf"), SCH)
    run("pcb", "export", "pdf", "-l", "F.Cu,F.Silkscreen,F.Fab,Edge.Cuts",
        "-o", os.path.join(FAB, "ai_glasses-assembly-top.pdf"), PCB)
    run("pcb", "export", "pdf", "-l", "B.Cu,B.Silkscreen,B.Fab,Edge.Cuts", "--mirror",
        "-o", os.path.join(FAB, "ai_glasses-assembly-bottom.pdf"), PCB)
    import shutil
    zipbase = os.path.join(FAB, "ai_glasses-gerbers")
    shutil.make_archive(zipbase, "zip", g)
    return bom()


if __name__ == "__main__":
    print(fab())

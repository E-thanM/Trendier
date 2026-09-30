"""Re-apply the post-route review fixes to a board produced by build.py.

    python3 build.py && python3 apply_fixes.py ../ai_glasses.kicad_pcb

Order (each step in its own process; repair.py re-routes collisions):
  1. usb_pair      - USB D+/D- as a coupled, length-matched pair through U8
  2. amp_power     - C18/C17 at U7's VDD pins, VSYS 2 mm trunk + B.Cu pour in
                     the strip, VSYS re-routed at 0.6 mm
  3. outline       - filleted Edge.Cuts (neck, taper, rear pad corner)
  4. micport       - 0.6 mm acoustic port + In1/In2/B.Cu keep-out
  5. stitching     - GND edge row + 1.2 mm grid on the front half
  6. silk          - battery polarity marks at J3
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable


def step(code, *args, env=None):
    e = dict(os.environ, **(env or {}))
    subprocess.run([PY, "-c", code, *args], cwd=HERE, check=True, env=e)


def repair(path, env=None):
    subprocess.run([PY, "repair.py", path], cwd=HERE, check=True,
                   env=dict(os.environ, **(env or {})))


def main(path):
    step("import sys,pcbnew,usb_pair; b=pcbnew.LoadBoard(sys.argv[1]); usb_pair.place(b); "
         "pcbnew.SaveBoard(sys.argv[1], b)", path)
    step("import sys,pcbnew,usb_pair; b=pcbnew.LoadBoard(sys.argv[1]); usb_pair.via_corridor(b); "
         "pcbnew.SaveBoard(sys.argv[1], b)", path)
    repair(path)
    subprocess.run([PY, "amp_power.py", path], cwd=HERE, check=True)
    subprocess.run([PY, "amp_power.py", path, "--trunk"], cwd=HERE, check=True)
    repair(path, env={"WIDTH_OVERRIDE": '{"VSYS": 0.6}'})
    for s in ("outline_remove", "outline_add", "micport"):
        subprocess.run([PY, "edits.py", s, path], cwd=HERE, check=True)
    repair(path)
    step("import sys,pcbnew,stitch; b=pcbnew.LoadBoard(sys.argv[1]); "
         "print('edge vias', stitch.edge_stitch(b, x_max=62)); pcbnew.SaveBoard(sys.argv[1], b)", path)
    step("import sys,pcbnew,stitch; b=pcbnew.LoadBoard(sys.argv[1]); "
         "print('grid vias', stitch.stitch(b, region=(7.6, 0.8, 62, 21.2), pitch=1.2, min_gap=1.1)); "
         "pcbnew.SaveBoard(sys.argv[1], b)", path)
    subprocess.run([PY, "edits.py", "silk", path], cwd=HERE, check=True)
    repair(path)


if __name__ == "__main__":
    main(os.path.abspath(sys.argv[1]))

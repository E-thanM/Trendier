# AI Glasses – Temple PCB

4-layer KiCad project for the electronics in one temple arm of the AI glasses:

- ESP32-S3-WROOM-1 (N16R8)
- DVP camera connector (OV2640 / OV5640)
- I2S MEMS microphone
- USB-C Li-Po charging
- I2S amplifier driving a bone-conduction transducer behind the ear

| File | What it is |
|---|---|
| `ai_glasses.kicad_pro` | open this in KiCad 7+ |
| `ai_glasses.kicad_sch` / `.kicad_pcb` | schematic and routed board |
| `fab/` | Gerbers (+ zip), drill files, pick-and-place, BOM, schematic and assembly PDFs |
| `docs/DESIGN.md` | design notes: shape and anthropometry, power tree, pin map, stack-up, verification, bring-up checklist |
| `VERIFICATION.txt` | output of `scripts/check_design.py` |
| `scripts/` | generators; `design.py` is the single source of truth |

**Note:** the Raspberry Pi Zero camera (MIPI CSI-2) can't connect to an
ESP32-S3. The board uses the pin-compatible-size DVP camera modules instead.
See `docs/DESIGN.md` §2.

## Opening it in KiCad and checking it

1. Install **KiCad 7 or newer**. If you open it in KiCad 8 or 9 and save,
   the files are upgraded and older versions can no longer open them.
2. Open `ai_glasses.kicad_pro`. Keep the whole folder together: the project's
   own symbol/footprint libraries (`AI_Glasses.*`) are found through
   `${KIPRJMOD}`.
3. **Schematic:** Inspect → Electrical Rules Checker → Run ERC. Expect
   0 errors. "Symbol doesn't match library" warnings are harmless; don't
   bulk-update symbols from the library.
4. **PCB:**
   - Press **B** to refill zones.
   - Run **Inspect → Design Rules Checker** with *Refill all zones*
     ticked. Expect 0 errors and 0 unconnected items. The custom rules
     in `ai_glasses.kicad_dru` load automatically.
   - Run **Tools → Update PCB from Schematic** (F8). It should list no
     changes; if it does, cancel.
5. **3D view** (Alt+3): the footprints reference
   `${KICAD7_3DMODEL_DIR}` / `${KICAD6_3DMODEL_DIR}`. On KiCad 8/9, if the
   models are missing, add those names under Preferences → Configure Paths,
   pointing at the same folder as your `KICAD8_`/`KICAD9_3DMODEL_DIR`. This
   only affects the 3D view.
6. **Fab files:** open `fab/gerbers/` in KiCad's Gerber Viewer. To order,
   upload `fab/ai_glasses-gerbers.zip`: 4 layers, 1.0 mm thick,
   1 oz outer / 0.5 oz inner. For assembly, add `fab/ai_glasses-BOM.csv`
   and `fab/ai_glasses-pos.csv`.

### Automated checks (optional)
Needs KiCad's Python module (`pcbnew`) and `pip install sexpdata numpy`.

```
cd scripts
python3 check_design.py   # 600+ checks: netlist match, wiring, links, ERC-style, DRC, placement
python3 check_wiring.py   # schematic wires/labels/no-connects only
```

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

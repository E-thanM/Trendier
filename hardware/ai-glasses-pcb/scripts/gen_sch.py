"""Generate the KiCad schematic (ai_glasses.kicad_sch) from design.py.

Every symbol pin gets a short wire stub and a net label, so connectivity is
exactly the pin->net map in design.py. NC pins get no-connect flags; power
nets get PWR_FLAGs so ERC knows they are driven.
"""
import copy
import os

import sexpdata
from sexpdata import Symbol as S

import design as D
import kicadlib as K

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.normpath(os.path.join(HERE, ".."))
G = 2.54
STUB = 2.54
PAPER = ("A2", 594.0, 420.0)
BLOCKS = [
    ("power", "USB-C, ESD, Li-Po charger, power path, 3.3 V LDO"),
    ("mcu", "ESP32-S3-WROOM-1 (N16R8), reset/boot, status LED, battery sense, UART pads"),
    ("camera", "DVP camera (OV2640/OV5640 24-pin FPC) + camera LDOs"),
    ("audio", "I2S MEMS microphone, I2S class-D amp, bone-conduction transducer"),
]


def snap(v):
    return round(v / G) * G


def uid(tag):
    return D.uuid_for("sch/" + tag)


def load_sym(lib_id):
    lib, name = lib_id.split(":")
    path = os.path.join(PROJ, "AI_Glasses.kicad_sym") if lib == "AI_Glasses" else None
    return K.find_symbol(lib, name, path)


def sym_bbox(sym):
    """Body+pin bbox in schematic orientation (y down), relative to origin."""
    xs, ys = [], []
    for sub in K.children(sym, "symbol"):
        for g in sub:
            t = K.tag(g)
            if t == "rectangle":
                for k in ("start", "end"):
                    c = K.child(g, k)
                    xs.append(c[1]); ys.append(-c[2])
            elif t == "polyline":
                for xy in K.children(K.child(g, "pts"), "xy"):
                    xs.append(xy[1]); ys.append(-xy[2])
            elif t == "circle":
                c = K.child(g, "center"); r = K.child(g, "radius")[1]
                xs += [c[1] - r, c[1] + r]; ys += [-c[2] - r, -c[2] + r]
    for p in K.pins(sym):
        xs.append(p["x"]); ys.append(-p["y"])
    return min(xs), min(ys), max(xs), max(ys)


def outward(angle):
    """Unit vector (schematic coords) pointing away from the body."""
    return {0: (-1, 0), 180: (1, 0), 90: (0, 1), 270: (0, -1)}[int(angle) % 360]


def label_len(net):
    return 1.27 * 0.8 * len(net) + 2.0


def fmt(v):
    return float(f"{v:.4f}")


def prop(name, value, x, y, hide=False, angle=0, justify=None):
    eff = [S("effects"), [S("font"), [S("size"), 1.27, 1.27]]]
    if justify:
        eff.append([S("justify"), S(justify)])
    if hide:
        eff.append(S("hide"))
    return [S("property"), name, value, [S("at"), fmt(x), fmt(y), angle], eff]


def build():
    items = []           # top-level schematic items
    lib_syms = {}
    placements = []      # (part, X, Y)

    # ---------- layout: shelf-pack each block, blocks flow left->right
    margin = 25.4
    x_cursor = margin
    y_top = margin + 12.7
    col_w = (PAPER[1] - 2 * margin) / 2
    block_origin = {
        "power": (margin, margin + 10),
        "mcu": (margin + col_w, margin + 10),
        "camera": (margin, PAPER[2] / 2 + 5),
        "audio": (margin + col_w, PAPER[2] / 2 + 5),
    }
    for block, title in BLOCKS:
        bx, by = block_origin[block]
        items.append([S("text"), f"{block.upper()}: {title}",
                      [S("at"), fmt(bx), fmt(by), 0],
                      [S("effects"), [S("font"), [S("size"), 2.54, 2.54], S("bold")],
                       [S("justify"), S("left"), S("bottom")]],
                      [S("uuid"), uid("title/" + block)]])
        x, y, shelf_h = bx, by + 10, 0.0
        right = bx + col_w - 10
        for p in [q for q in D.PARTS if q["block"] == block]:
            sym = load_sym(p["sym"])
            x0, y0, x1, y1 = sym_bbox(sym)
            longest = max([label_len(n) for n in p["pins"].values() if n] + [4])
            w = (x1 - x0) + 2 * (STUB + longest) + 8
            h = (y1 - y0) + 2 * (STUB + longest if any(
                abs(pp["angle"]) % 180 == 90 for pp in K.pins(sym)) else 6) + 8
            if x + w > right:
                x, y, shelf_h = bx, y + shelf_h, 0.0
            X = snap(x + STUB + longest + 4 - x0)
            Y = snap(y + (h - (y1 - y0)) / 2 - y0)
            placements.append((p, X, Y, sym))
            x += w
            shelf_h = max(shelf_h, h)

    # ---------- symbols
    for p, X, Y, sym in placements:
        lib_id = p["sym"]
        if lib_id not in lib_syms:
            s = copy.deepcopy(sym)
            s[1] = lib_id
            lib_syms[lib_id] = s
        ref_uuid = D.uuid_for(p["ref"])
        pins = K.pins(sym)
        ref_p = K.prop(sym, "Reference")
        ref_at = next(c for c in K.children(sym, "property") if c[1] == "Reference")
        val_at = next(c for c in K.children(sym, "property") if c[1] == "Value")
        ra, va = K.child(ref_at, "at"), K.child(val_at, "at")
        node = [S("symbol"), [S("lib_id"), lib_id], [S("at"), fmt(X), fmt(Y), 0],
                [S("unit"), 1], [S("in_bom"), S("yes")], [S("on_board"), S("yes")],
                [S("dnp"), S("no")], [S("uuid"), ref_uuid],
                prop("Reference", p["ref"], X + ra[1], Y - ra[2]),
                prop("Value", p["value"], X + va[1], Y - va[2]),
                prop("Footprint", p["fp"], X, Y, hide=True),
                prop("Datasheet", K.prop(sym, "Datasheet") or "", X, Y, hide=True)]
        if p["mpn"]:
            node.append(prop("MPN", p["mpn"], X, Y, hide=True))
        if p["desc"]:
            node.append(prop("Description", p["desc"], X, Y, hide=True))
        for pp in pins:
            node.append([S("pin"), pp["number"], [S("uuid"), uid(f"{p['ref']}/pin/{pp['number']}")]])
        node.append([S("instances"), [S("project"), "ai_glasses",
                     [S("path"), "/" + D.ROOT_UUID, [S("reference"), p["ref"]], [S("unit"), 1]]]])
        items.append(node)

        # ---------- stubs + labels per pin location
        by_loc = {}
        for pp in pins:
            by_loc.setdefault((pp["x"], pp["y"]), []).append(pp)
        for (px, py), group in by_loc.items():
            nets = {p["pins"].get(g["number"], "MISSING") for g in group}
            if "MISSING" in nets:
                raise SystemExit(f"{p['ref']}: pins {[g['number'] for g in group]} not in design")
            if len(nets) != 1:
                raise SystemExit(f"{p['ref']}: stacked pins disagree {nets}")
            net = nets.pop()
            vis = [g for g in group if not g["hide"]]
            if not vis:
                if net is not None:
                    raise SystemExit(f"{p['ref']}: hidden pin carries net {net}")
                continue    # hidden NC pin (e.g. SOT-23-5 NC)
            ax, ay = X + px, Y - py
            dx, dy = outward(vis[0]["angle"])
            tag = f"{p['ref']}/{vis[0]['number']}"
            if net is None:
                items.append([S("no_connect"), [S("at"), fmt(ax), fmt(ay)], [S("uuid"), uid("nc/" + tag)]])
                continue
            bx_, by_ = ax + dx * STUB, ay + dy * STUB
            items.append([S("wire"), [S("pts"), [S("xy"), fmt(ax), fmt(ay)], [S("xy"), fmt(bx_), fmt(by_)]],
                          [S("stroke"), [S("width"), 0], [S("type"), S("default")]],
                          [S("uuid"), uid("w/" + tag)]])
            angle, just = {(-1, 0): (180, "right"), (1, 0): (0, "left"),
                           (0, -1): (90, "left"), (0, 1): (270, "right")}[(dx, dy)]
            items.append([S("label"), net, [S("at"), fmt(bx_), fmt(by_), angle],
                          [S("fields_autoplaced")],
                          [S("effects"), [S("font"), [S("size"), 1.27, 1.27]],
                           [S("justify"), S(just), S("bottom")]],
                          [S("uuid"), uid("l/" + tag)]])

    # ---------- PWR_FLAGs (bottom-right corner)
    flag = K.find_symbol("power", "PWR_FLAG")
    fs = copy.deepcopy(flag)
    fs[1] = "power:PWR_FLAG"
    lib_syms["power:PWR_FLAG"] = fs
    fx, fy = snap(PAPER[1] - 130), snap(PAPER[2] - 70)
    items.append([S("text"), "Power flags (tell ERC these nets are driven)",
                  [S("at"), fmt(fx - 5), fmt(fy - 12), 0],
                  [S("effects"), [S("font"), [S("size"), 1.8, 1.8]], [S("justify"), S("left"), S("bottom")]],
                  [S("uuid"), uid("title/flags")]])
    for i, net in enumerate(D.POWER_FLAG_NETS):
        x, y = fx + i * 25.4, fy
        ref = f"#FLG0{i + 1}"
        items.append([S("symbol"), [S("lib_id"), "power:PWR_FLAG"], [S("at"), fmt(x), fmt(y), 0],
                      [S("unit"), 1], [S("in_bom"), S("yes")], [S("on_board"), S("yes")],
                      [S("dnp"), S("no")], [S("uuid"), uid("flag/" + net)],
                      prop("Reference", ref, x, y - 3.81, hide=True),
                      prop("Value", "PWR_FLAG", x, y - 3.81),
                      prop("Footprint", "", x, y, hide=True),
                      prop("Datasheet", "~", x, y, hide=True),
                      [S("pin"), "1", [S("uuid"), uid("flagpin/" + net)]],
                      [S("instances"), [S("project"), "ai_glasses",
                       [S("path"), "/" + D.ROOT_UUID, [S("reference"), ref], [S("unit"), 1]]]]])
        items.append([S("wire"), [S("pts"), [S("xy"), fmt(x), fmt(y)], [S("xy"), fmt(x), fmt(y + STUB)]],
                      [S("stroke"), [S("width"), 0], [S("type"), S("default")]], [S("uuid"), uid("fw/" + net)]])
        items.append([S("label"), net, [S("at"), fmt(x), fmt(y + STUB), 270], [S("fields_autoplaced")],
                      [S("effects"), [S("font"), [S("size"), 1.27, 1.27]], [S("justify"), S("right"), S("bottom")]],
                      [S("uuid"), uid("fl/" + net)]])

    # ---------- notes
    notes = [
        "GPIO map: IO4 VBAT_SENSE | IO5/6/7 MIC SCK/WS/SD (I2S0) | IO15/16/17 AMP BCLK/LRCLK/DIN (I2S1) | IO18 AMP_SD",
        "IO8 status LED | IO19/20 USB D-/D+ | IO9-14,21,47 CAM D0-D7 | IO48 PCLK | IO38 VSYNC | IO39 HREF | IO40 XCLK",
        "IO41 SIOD | IO42 SIOC | IO2 PWDN | IO1 RESET | IO0 BOOT button | IO43/44 UART test pads",
        "Do not use IO35/36/37 (octal PSRAM on N16R8). IO3/IO45/IO46 are strapping pins and left unconnected.",
        "Charge current = 1000 V / R4 = 196 mA (R4 = 5.1k). Change R4 to suit the battery (<= 1C).",
    ]
    for i, n in enumerate(notes):
        items.append([S("text"), n, [S("at"), fmt(margin), fmt(PAPER[2] - 34 + i * 4.5), 0],
                      [S("effects"), [S("font"), [S("size"), 1.8, 1.8]], [S("justify"), S("left"), S("bottom")]],
                      [S("uuid"), uid(f"note/{i}")]])

    sch = [S("kicad_sch"), [S("version"), 20230121], [S("generator"), S("eeschema")],
           [S("uuid"), D.ROOT_UUID], [S("paper"), PAPER[0]],
           [S("title_block"), [S("title"), "AI Glasses - Temple PCB"], [S("date"), "2026-09-30"],
            [S("rev"), "1.0"], [S("company"), "Trendier"],
            [S("comment"), 1, "ESP32-S3-WROOM-1 + DVP camera + I2S mic + I2S amp/bone transducer + Li-Po charger"],
            [S("comment"), 2, "Generated from scripts/design.py - edit that file and regenerate"]],
           [S("lib_symbols")] + list(lib_syms.values())]
    sch += items
    sch.append([S("sheet_instances"), [S("path"), "/", [S("page"), "1"]]])
    out = os.path.join(PROJ, "ai_glasses.kicad_sch")
    with open(out, "w") as f:
        f.write(sexpdata.dumps(sch) + "\n")
    return out


if __name__ == "__main__":
    print(build())

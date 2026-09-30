"""Schematic wiring integrity straight from the .kicad_sch file:
every wire joins a pin to a label, every label sits on a wire end, every
no-connect flag sits on an unconnected pin, and nothing dangles."""
import sys
from collections import defaultdict

import sexpdata

import kicadlib as K

path = sys.argv[1] if len(sys.argv) > 1 else "../ai_glasses.kicad_sch"
d = sexpdata.loads(open(path).read())
libs = {s[1]: s for s in K.children(K.child(d, "lib_symbols"), "symbol")}


def key(x, y):
    return (round(float(x), 3), round(float(y), 3))


pins = defaultdict(list)         # point -> [(ref, pin number, hidden)]
for s in K.children(d, "symbol"):
    lib_id = K.child(s, "lib_id")[1]
    at = K.child(s, "at")
    X, Y = float(at[1]), float(at[2])
    ref = {p[1]: p[2] for p in K.children(s, "property")}["Reference"]
    for p in K.pins(libs[lib_id]):
        pins[key(X + p["x"], Y - p["y"])].append((ref, p["number"], p["hide"]))

wires = [[key(*xy[1:]) for xy in K.children(K.child(w, "pts"), "xy")] for w in K.children(d, "wire")]
labels = defaultdict(list)
for l in K.children(d, "label"):
    at = K.child(l, "at")
    labels[key(at[1], at[2])].append(l[1])
ncs = [key(*K.child(n, "at")[1:3]) for n in K.children(d, "no_connect")]

problems = []
ends = defaultdict(int)
for w in wires:
    for p in w:
        ends[p] += 1
    a, b = w
    on_pin = [p for p in (a, b) if p in pins]
    on_lab = [p for p in (a, b) if p in labels]
    if len(on_pin) != 1 or len(on_lab) != 1:
        problems.append(f"wire {a}->{b}: pin ends {len(on_pin)}, label ends {len(on_lab)}")
for p, names in labels.items():
    if len(set(names)) > 1:
        problems.append(f"conflicting labels at {p}: {names}")
    if ends[p] == 0:
        problems.append(f"label {names} at {p} not on a wire (dangling)")
for p in ncs:
    if p not in pins:
        problems.append(f"no-connect flag at {p} not on a pin")
    elif ends[p]:
        problems.append(f"no-connect flag at {p} but a wire is attached")
visible_unwired = [(p, v) for p, v in pins.items()
                   if not ends[p] and p not in ncs and any(not h for _, _, h in v)]
for p, v in visible_unwired:
    problems.append(f"pin(s) {v} at {p} have no wire and no no-connect flag")
print(f"symbols: {len(K.children(d, 'symbol'))}, pin points: {len(pins)}, wires: {len(wires)}, "
      f"labels: {sum(len(v) for v in labels.values())}, no-connect flags: {len(ncs)}")
print("\n".join(problems) if problems else "WIRING OK: every wire pin->label, no dangling labels/wires, "
      "every NC flag on an unconnected pin, every visible pin accounted for")
sys.exit(1 if problems else 0)

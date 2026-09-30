"""Helpers to read KiCad symbol libraries (S-expression) without eeschema."""
import os
import sexpdata
from sexpdata import Symbol

SYMDIR = os.environ.get("KICAD_SYMBOL_DIR", "/usr/share/kicad/symbols")
_cache = {}


def S(x):
    return Symbol(x)


def tag(node):
    return str(node[0]) if isinstance(node, list) and node and isinstance(node[0], Symbol) else None


def children(node, name):
    return [c for c in node if tag(c) == name]


def child(node, name):
    for c in node:
        if tag(c) == name:
            return c
    return None


def load_lib(path):
    if path not in _cache:
        with open(path) as f:
            _cache[path] = sexpdata.loads(f.read())
    return _cache[path]


def find_symbol(lib, name, libpath=None):
    libpath = libpath or os.path.join(SYMDIR, lib + ".kicad_sym")
    data = load_lib(libpath)
    for s in children(data, "symbol"):
        if s[1] == name:
            ext = child(s, "extends")
            if ext is not None:
                parent = find_symbol(lib, ext[1], libpath)
                return derive(parent, s, name)
            return s
    raise KeyError(f"{lib}:{name}")


def derive(parent, child_sym, name):
    """Flatten an 'extends' symbol: parent graphics/pins + child properties."""
    import copy
    new = copy.deepcopy(parent)
    new[1] = name
    props = {p[1]: p for p in children(child_sym, "property")}
    out = []
    for c in new:
        if tag(c) == "property" and c[1] in props:
            out.append(copy.deepcopy(props.pop(c[1])))
        elif tag(c) == "symbol":
            c = copy.deepcopy(c)
            old = parent[1]
            c[1] = c[1].replace(old, name, 1)
            out.append(c)
        else:
            out.append(c)
    # insert remaining new props after the last property
    idx = max(i for i, c in enumerate(out) if tag(c) == "property") + 1
    for p in props.values():
        out.insert(idx, copy.deepcopy(p))
        idx += 1
    return out


def pins(sym, unit=None):
    """Return list of dicts: number, name, type, x, y, angle, length, unit."""
    res = []
    for sub in children(sym, "symbol"):
        suffix = sub[1].rsplit("_", 2)
        u = int(suffix[-2])
        if unit is not None and u not in (0, unit):
            continue
        for p in children(sub, "pin"):
            at = child(p, "at")
            res.append(dict(
                type=str(p[1]), number=child(p, "number")[1], name=child(p, "name")[1],
                x=float(at[1]), y=float(at[2]), angle=float(at[3]) if len(at) > 3 else 0.0,
                length=float(child(p, "length")[1]), unit=u,
                hide=any(isinstance(t, Symbol) and str(t) == "hide" for t in p)))
    return res


def prop(sym, name):
    for p in children(sym, "property"):
        if p[1] == name:
            return p[2]
    return None

"""Run KiCad's DRC engine headless and summarise the report."""
import collections
import os
import re
import sys

import pcbnew

path = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(path)[0] + "-drc.rpt"
board = pcbnew.LoadBoard(path)
pcbnew.ZONE_FILLER(board).Fill(board.Zones())
pcbnew.WriteDRCReport(board, out, pcbnew.EDA_UNITS_MILLIMETRES, True)
txt = open(out).read()
kinds = collections.Counter(re.findall(r"^\[(\w+)\]", txt, re.M))
print(out)
for line in txt.splitlines():
    if line.startswith("**"):
        print(line)
for k, v in kinds.most_common():
    print(f"  {k}: {v}")

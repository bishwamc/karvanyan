"""Merge several fuzz.py result files into one (same policy). Usage: merge.py out.json in1.json in2.json ..."""
import json, sys, csv
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from fuzz import summarise
rows = [r for f in sys.argv[2:] for r in json.load(open(f))["runs"]]
s = summarise(rows); s["policy"] = rows[0].get("policy")
Path(sys.argv[1]).write_text(json.dumps({"summary": s, "runs": rows}, indent=2))
with open(Path(sys.argv[1]).with_suffix(".csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["policy","seed","merchant","win","day","score","cause","errors","steps"], extrasaction="ignore")
    w.writeheader(); w.writerows(rows)
print(json.dumps(s, indent=1))

#!/bin/sh
# Run the four bot policies in parallel, detached. Usage: run_suite.sh <url> <outdir> <runs>
URL=${1:-http://localhost:8080/baseline/}; OUT=${2:-docs/baseline-results}; N=${3:-100}
cd "$(dirname "$0")/../.." && . tools/serve.sh
for p in random careful guide hunt; do
  setsid nohup python3 tools/bots/fuzz.py --url "$URL" --policy $p --runs $N --out "$OUT/$p.json" > "/tmp/bot-$p.log" 2>&1 < /dev/null &
done

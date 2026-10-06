#!/bin/sh
# Start a local static server on :8080 if one is not already running.
curl -s -o /dev/null http://localhost:8080/ 2>/dev/null || (python3 -m http.server 8080 >/tmp/karvanyan-serve.log 2>&1 &)
sleep 1

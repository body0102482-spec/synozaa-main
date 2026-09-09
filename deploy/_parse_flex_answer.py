#!/usr/bin/env python3
import json
import re
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

path = r"C:\Users\Eng-Loay\.cursor\projects\c-Users-Eng-Loay-Desktop-Synoza\agent-tools\5c350817-3470-48f1-b309-e6965711deb8.txt"
text = open(path, encoding="utf-8", errors="replace").read()

# Search all JSON arrays for the flex question
for m in re.finditer(r"(\[\{\"id\":.*?\}\])", text):
    raw = m.group(1)
    if "flex" not in raw.lower() and "lower limb" not in raw.lower():
        continue
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        continue
    for q in data:
        qs = q.get("question", "")
        if re.search(r"flex|lower limb|ideal position", qs, re.I):
            print("QUESTION:")
            print(qs)
            print()
            print("SAMPLE ANSWER (from dashboard):")
            print(q.get("sampleAnswer", ""))
            print("\n" + "=" * 60 + "\n")

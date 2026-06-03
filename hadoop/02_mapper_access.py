#!/usr/bin/env python3
"""Mapper: emit (tanggal, status) -> 1 untuk semua event"""
import sys
import json

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        event = json.loads(line)
        waktu = event.get('waktu', '')
        status = event.get('status', '')

        if not waktu or not status:
            continue

        date = waktu[:10]
        print(f"{date}\t{status}\t1")
    except Exception:
        pass

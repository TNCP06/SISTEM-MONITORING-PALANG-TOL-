#!/usr/bin/env python3
"""Mapper: emit (tanggal, jam, tipe_gate) -> 1 untuk event DITERIMA"""
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
        tipe_gate = event.get('tipe_gate', '')

        if not waktu or status != 'DITERIMA':
            continue

        date = waktu[:10]    # YYYY-MM-DD
        hour = waktu[11:13]  # HH
        print(f"{date}\t{hour}\t{tipe_gate}\t1")
    except Exception:
        pass

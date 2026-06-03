#!/usr/bin/env python3
"""Mapper: emit (tanggal, biaya) untuk event KELUAR+DITERIMA"""
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
        biaya = event.get('biaya', 5000)

        if status != 'DITERIMA' or tipe_gate != 'KELUAR':
            continue
        if not biaya:
            biaya = 5000

        date = waktu[:10]
        print(f"{date}\t{biaya}")
    except Exception:
        pass

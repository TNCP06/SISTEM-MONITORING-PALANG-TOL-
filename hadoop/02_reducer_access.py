#!/usr/bin/env python3
"""Reducer: agregasi DITERIMA vs DITOLAK per tanggal"""
import sys
from collections import defaultdict

counts = defaultdict(lambda: {'DITERIMA': 0, 'DITOLAK': 0})

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    parts = line.split('\t')
    if len(parts) != 3:
        continue
    date, status, count = parts
    if status in counts[date]:
        counts[date][status] += int(count)

for date in sorted(counts):
    diterima = counts[date]['DITERIMA']
    ditolak = counts[date]['DITOLAK']
    print(f"{date}\t{diterima}\t{ditolak}")

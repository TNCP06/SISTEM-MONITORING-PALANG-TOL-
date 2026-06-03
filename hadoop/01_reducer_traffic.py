#!/usr/bin/env python3
"""Reducer: agregasi jumlah masuk/keluar per jam per tanggal"""
import sys
from collections import defaultdict

counts = defaultdict(lambda: defaultdict(lambda: {'MASUK': 0, 'KELUAR': 0}))

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    parts = line.split('\t')
    if len(parts) != 4:
        continue
    date, hour, tipe_gate, count = parts
    if tipe_gate in counts[date][hour]:
        counts[date][hour][tipe_gate] += int(count)

for date in sorted(counts):
    for hour in sorted(counts[date]):
        masuk = counts[date][hour]['MASUK']
        keluar = counts[date][hour]['KELUAR']
        print(f"{date}\t{hour}:00\t{masuk}\t{keluar}")

#!/usr/bin/env python3
"""Reducer: total revenue per tanggal"""
import sys
from collections import defaultdict

revenue = defaultdict(int)

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    parts = line.split('\t')
    if len(parts) != 2:
        continue
    date, biaya = parts
    revenue[date] += int(biaya)

for date in sorted(revenue):
    print(f"{date}\t{revenue[date]}")

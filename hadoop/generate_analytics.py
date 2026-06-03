#!/usr/bin/env python3
"""
Baca hasil MapReduce dari HDFS, buat analytics JSON, upload ke S3.
Jalankan SETELAH run_jobs.sh berhasil selesai.

Usage:
    python3 generate_analytics.py
"""
import subprocess
import json
import sys

try:
    import boto3
except ImportError:
    print("ERROR: boto3 tidak ditemukan.")
    print("Install dengan: pip3 install boto3")
    sys.exit(1)

AWS_REGION  = "ap-southeast-1"
S3_BUCKET   = "tol-hadoop-raw-caturp"
S3_KEY      = "analytics/result.json"
HDFS_OUTPUT = "/user/hadoop/tol/output"


def read_hdfs(path):
    """Baca semua part-* files dari direktori HDFS."""
    result = subprocess.run(
        ["hdfs", "dfs", "-cat", f"{path}/part-*"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"WARNING: gagal baca {path}")
        print(f"  stderr: {result.stderr.strip()}")
        return ""
    return result.stdout


print("Membaca hasil MapReduce dari HDFS...")

# --- Traffic: date \t hour:00 \t masuk \t keluar ---
traffic_data = []
for line in read_hdfs(f"{HDFS_OUTPUT}/traffic").strip().split('\n'):
    if not line:
        continue
    parts = line.split('\t')
    if len(parts) == 4:
        traffic_data.append({
            "tanggal": parts[0],
            "jam":     parts[1],
            "masuk":   int(parts[2]),
            "keluar":  int(parts[3])
        })

# --- Access: date \t diterima \t ditolak ---
access_data = []
for line in read_hdfs(f"{HDFS_OUTPUT}/access").strip().split('\n'):
    if not line:
        continue
    parts = line.split('\t')
    if len(parts) == 3:
        access_data.append({
            "tanggal":  parts[0],
            "diterima": int(parts[1]),
            "ditolak":  int(parts[2])
        })

# --- Revenue: date \t revenue ---
revenue_data = []
for line in read_hdfs(f"{HDFS_OUTPUT}/revenue").strip().split('\n'):
    if not line:
        continue
    parts = line.split('\t')
    if len(parts) == 2:
        revenue_data.append({
            "tanggal": parts[0],
            "revenue": int(parts[1])
        })

if not traffic_data and not access_data and not revenue_data:
    print("ERROR: Semua output kosong. Pastikan run_jobs.sh sudah dijalankan.")
    sys.exit(1)

result = {
    "trafficVolume":    traffic_data,
    "accessValidation": access_data,
    "revenueHarian":    revenue_data
}

print(f"  Traffic entries  : {len(traffic_data)}")
print(f"  Access entries   : {len(access_data)}")
print(f"  Revenue entries  : {len(revenue_data)}")

# Upload ke S3
print(f"\nUpload ke s3://{S3_BUCKET}/{S3_KEY} ...")
s3 = boto3.client('s3', region_name=AWS_REGION)
s3.put_object(
    Bucket=S3_BUCKET,
    Key=S3_KEY,
    Body=json.dumps(result, indent=2),
    ContentType='application/json'
)

print("Berhasil! Analytics result sudah tersimpan di S3.")
print(f"\nVerifikasi:")
print(f"  aws s3 cp s3://{S3_BUCKET}/{S3_KEY} /tmp/check.json && python3 -m json.tool /tmp/check.json | head -30")

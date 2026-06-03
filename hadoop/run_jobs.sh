#!/bin/bash
set -e

# Sesuaikan HADOOP_HOME jika path berbeda di cluster Anda
HADOOP_HOME=${HADOOP_HOME:-/opt/hadoop}
STREAMING_JAR=$(find $HADOOP_HOME -name "hadoop-streaming-*.jar" | head -1)

if [ -z "$STREAMING_JAR" ]; then
    echo "ERROR: hadoop-streaming JAR tidak ditemukan di $HADOOP_HOME"
    echo "Coba: find / -name 'hadoop-streaming-*.jar' 2>/dev/null"
    exit 1
fi

HDFS_INPUT=/user/hadoop/tol/input
HDFS_OUTPUT=/user/hadoop/tol/output
SCRIPT_DIR=$(dirname "$(realpath "$0")")

echo "============================================"
echo " Sistem Monitoring Palang Tol - Hadoop Jobs"
echo "============================================"
echo "Streaming JAR : $STREAMING_JAR"
echo "HDFS Input    : $HDFS_INPUT"
echo "HDFS Output   : $HDFS_OUTPUT"
echo "Script Dir    : $SCRIPT_DIR"
echo ""

# Verifikasi input ada di HDFS
echo "Verifikasi input HDFS..."
hdfs dfs -ls $HDFS_INPUT/ || { echo "ERROR: Input HDFS tidak ditemukan. Jalankan step ingest data dulu."; exit 1; }

# Hapus output sebelumnya (jika ada)
echo "Membersihkan output lama..."
hdfs dfs -rm -r -f $HDFS_OUTPUT/traffic $HDFS_OUTPUT/access $HDFS_OUTPUT/revenue
echo ""

# -----------------------------------------------
# Job 1: Hourly Traffic (MASUK/KELUAR per jam)
# -----------------------------------------------
echo "=== [1/3] Job: Hourly Traffic ==="
hadoop jar $STREAMING_JAR \
  -files $SCRIPT_DIR/01_mapper_traffic.py,$SCRIPT_DIR/01_reducer_traffic.py \
  -mapper  "python3 01_mapper_traffic.py" \
  -reducer "python3 01_reducer_traffic.py" \
  -input  $HDFS_INPUT/ \
  -output $HDFS_OUTPUT/traffic
echo "Job 1 selesai."
echo ""

# -----------------------------------------------
# Job 2: Access Validation (DITERIMA vs DITOLAK)
# -----------------------------------------------
echo "=== [2/3] Job: Access Validation ==="
hadoop jar $STREAMING_JAR \
  -files $SCRIPT_DIR/02_mapper_access.py,$SCRIPT_DIR/02_reducer_access.py \
  -mapper  "python3 02_mapper_access.py" \
  -reducer "python3 02_reducer_access.py" \
  -input  $HDFS_INPUT/ \
  -output $HDFS_OUTPUT/access
echo "Job 2 selesai."
echo ""

# -----------------------------------------------
# Job 3: Revenue Harian (sum biaya KELUAR+DITERIMA)
# -----------------------------------------------
echo "=== [3/3] Job: Revenue Harian ==="
hadoop jar $STREAMING_JAR \
  -files $SCRIPT_DIR/03_mapper_revenue.py,$SCRIPT_DIR/03_reducer_revenue.py \
  -mapper  "python3 03_mapper_revenue.py" \
  -reducer "python3 03_reducer_revenue.py" \
  -input  $HDFS_INPUT/ \
  -output $HDFS_OUTPUT/revenue
echo "Job 3 selesai."
echo ""

echo "============================================"
echo " Semua MapReduce job berhasil!"
echo "============================================"
echo ""
echo "Verifikasi output:"
hdfs dfs -ls $HDFS_OUTPUT/
echo ""
echo "Langkah selanjutnya:"
echo "  python3 $SCRIPT_DIR/generate_analytics.py"

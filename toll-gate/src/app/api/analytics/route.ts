import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "ap-southeast-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET        = "tol-hadoop-raw-caturp";
const ANALYTICS_KEY = "analytics/result.json";

interface TrafficEntry  { tanggal: string; jam: string; masuk: number; keluar: number }
interface AccessEntry   { tanggal: string; diterima: number; ditolak: number }
interface RevenueEntry  { tanggal: string; revenue: number }
interface AnalyticsData {
  trafficVolume:    TrafficEntry[];
  accessValidation: AccessEntry[];
  revenueHarian:    RevenueEntry[];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") ?? "2000-01-01";
    const to   = searchParams.get("to")   ?? "2099-12-31";

    // Baca hasil Hadoop dari S3
    const cmd      = new GetObjectCommand({ Bucket: BUCKET, Key: ANALYTICS_KEY });
    const response = await s3.send(cmd);
    const body     = await response.Body?.transformToString();
    const data: AnalyticsData = JSON.parse(body!);

    // Filter berdasarkan date range
    const trafficFiltered = data.trafficVolume.filter(
      (t) => t.tanggal >= from && t.tanggal <= to
    );
    const accessFiltered = data.accessValidation.filter(
      (a) => a.tanggal >= from && a.tanggal <= to
    );
    const revenueHarian = data.revenueHarian
      .filter((r) => r.tanggal >= from && r.tanggal <= to)
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

    // ── Traffic Volume per jam (agregasi semua tanggal dalam range) ──────────
    const hourMap: Record<string, { masuk: number; keluar: number }> = {};
    for (let h = 0; h < 24; h++) {
      hourMap[`${String(h).padStart(2, "0")}:00`] = { masuk: 0, keluar: 0 };
    }
    for (const t of trafficFiltered) {
      if (hourMap[t.jam]) {
        hourMap[t.jam].masuk  += t.masuk;
        hourMap[t.jam].keluar += t.keluar;
      }
    }
    const trafficVolume = Object.entries(hourMap).map(([jam, v]) => ({
      jam,
      masuk:  v.masuk,
      keluar: v.keluar,
    }));

    // ── Access Validation (DITERIMA vs DITOLAK) ──────────────────────────────
    let totalDiterima = 0;
    let totalDitolak  = 0;
    for (const a of accessFiltered) {
      totalDiterima += a.diterima;
      totalDitolak  += a.ditolak;
    }
    const accessValidation = [
      { name: "Diterima", value: totalDiterima },
      { name: "Ditolak",  value: totalDitolak  },
    ];

    // ── Summary stats ────────────────────────────────────────────────────────
    const totalMasuk     = trafficFiltered.reduce((s, t) => s + t.masuk,  0);
    const totalKeluar    = trafficFiltered.reduce((s, t) => s + t.keluar, 0);
    const totalRevenue   = revenueHarian.reduce((s, r) => s + r.revenue, 0);
    const totalTransaksi = totalDiterima + totalDitolak;
    const successRate    = totalTransaksi > 0
      ? Math.round((totalDiterima / totalTransaksi) * 10000) / 100
      : 0;

    return NextResponse.json({
      trafficVolume,
      accessValidation,
      revenueHarian,
      stats: {
        totalMasuk,
        totalKeluar,
        diDalam:       totalMasuk - totalKeluar,
        totalRevenue,
        totalTransaksi,
        successRate,
      },
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

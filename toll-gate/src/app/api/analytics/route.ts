import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { NextRequest, NextResponse } from "next/server";

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  }),
);

const DEFAULT_TOLL_FEE = 5000;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from"); // YYYY-MM-DD
    const to   = searchParams.get("to");   // YYYY-MM-DD

    const result = await client.send(new ScanCommand({ TableName: "tol_events" }));
    let items = result.Items || [];

    // Filter berdasarkan date range jika diberikan
    if (from || to) {
      const fromMs = from ? new Date(from + "T00:00:00").getTime() : 0;
      const toMs   = to   ? new Date(to   + "T23:59:59").getTime() : Infinity;
      items = items.filter((item) => {
        const t = new Date(item.waktu).getTime();
        return t >= fromMs && t <= toMs;
      });
    }

    // ── Traffic Volume per jam (MASUK + KELUAR) ──────────────────────────────
    const hourMap: Record<string, { jam: string; masuk: number; keluar: number }> = {};
    for (const item of items) {
      if (item.status !== "DITERIMA") continue;
      const dt  = new Date(item.waktu);
      const jam = `${String(dt.getHours()).padStart(2, "0")}:00`;
      if (!hourMap[jam]) hourMap[jam] = { jam, masuk: 0, keluar: 0 };
      if (item.tipe_gate === "MASUK")  hourMap[jam].masuk++;
      if (item.tipe_gate === "KELUAR") hourMap[jam].keluar++;
    }
    const trafficVolume = Array.from({ length: 24 }, (_, h) => {
      const jam = `${String(h).padStart(2, "0")}:00`;
      return hourMap[jam] ?? { jam, masuk: 0, keluar: 0 };
    });

    // ── Access Validation (DITERIMA vs DITOLAK) ──────────────────────────────
    const diterima = items.filter((i) => i.status === "DITERIMA").length;
    const ditolak  = items.filter((i) => i.status === "DITOLAK").length;
    const accessValidation = [
      { name: "Diterima", value: diterima },
      { name: "Ditolak",  value: ditolak  },
    ];

    // ── Revenue harian (dari KELUAR DITERIMA) ────────────────────────────────
    const revenueMap: Record<string, number> = {};
    for (const item of items) {
      if (item.status !== "DITERIMA" || item.tipe_gate !== "KELUAR") continue;
      const tanggal = item.waktu.slice(0, 10); // YYYY-MM-DD
      revenueMap[tanggal] = (revenueMap[tanggal] || 0) + (Number(item.biaya) || DEFAULT_TOLL_FEE);
    }
    const revenueHarian = Object.entries(revenueMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tanggal, revenue]) => ({ tanggal, revenue }));

    // ── Summary stats ────────────────────────────────────────────────────────
    const totalMasuk  = items.filter((i) => i.status === "DITERIMA" && i.tipe_gate === "MASUK").length;
    const totalKeluar = items.filter((i) => i.status === "DITERIMA" && i.tipe_gate === "KELUAR").length;
    const totalRevenue = items
      .filter((i) => i.status === "DITERIMA" && i.tipe_gate === "KELUAR")
      .reduce((sum, i) => sum + (Number(i.biaya) || DEFAULT_TOLL_FEE), 0);
    const successRate = items.length > 0
      ? Math.round((diterima / items.length) * 100 * 10) / 10
      : 0;

    return NextResponse.json({
      trafficVolume,
      accessValidation,
      revenueHarian,
      stats: {
        totalMasuk,
        totalKeluar,
        diDalam: totalMasuk - totalKeluar,
        totalRevenue,
        totalTransaksi: items.length,
        successRate,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

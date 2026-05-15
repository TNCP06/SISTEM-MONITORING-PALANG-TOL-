import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  }),
);

const DEFAULT_TOLL_FEE = 100000;

/**
 * Derive keterangan tidak tersimpan di DB
 */
function deriveKeterangan(item: any, tollFee: number): string {
  if (item.status === "DITERIMA") return "Transaksi berhasil";
  if (item.saldo_sebelum !== undefined && item.saldo_sebelum < tollFee) {
    return `Saldo tidak mencukupi (saldo: Rp ${Number(item.saldo_sebelum).toLocaleString("id-ID")})`;
  }
  return item.keterangan_raw || "Kartu tidak terdaftar";
}

export async function GET() {
  try {
    const result = await client.send(
      new ScanCommand({ TableName: "tol_events" }),
    );
    const items = result.Items || [];

    let tollFee = DEFAULT_TOLL_FEE;
    try {
      const cfg = await client.send(
        new ScanCommand({ TableName: "toll_config" }),
      );
      if (cfg.Items && cfg.Items.length > 0) {
        tollFee = Number(cfg.Items[0].biaya_tol) || DEFAULT_TOLL_FEE;
      }
    } catch {
      // toll_config tidak ada, pakai default
    }

    // Hitung statistik
    const accepted = items.filter((i) => i.status === "DITERIMA");
    const masuk = accepted.filter((i) => i.tipe_gate === "MASUK").length;
    const keluar = accepted.filter((i) => i.tipe_gate === "KELUAR").length;
    const totalRevenue = accepted
      .filter((i) => i.tipe_gate === "MASUK")
      .reduce((sum, i) => sum + (Number(i.biaya) || tollFee), 0);

    const sorted = items.sort(
      (a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime(),
    );

    const transactions = sorted.map((item) => ({
      uid: item.uid,
      waktu: item.waktu,
      status: item.status,
      tipe_gate: item.tipe_gate,
      biaya:
        item.status === "DITERIMA" && item.tipe_gate === "MASUK"
          ? Number(item.biaya) || tollFee
          : 0,
      saldo_sebelum: item.saldo_sebelum ?? null,
      saldo_sesudah: item.saldo_sesudah ?? null,
      keterangan: item.keterangan || deriveKeterangan(item, tollFee),
    }));

    return NextResponse.json({
      transactions,
      stats: {
        total_masuk: masuk,
        total_keluar: keluar,
        di_dalam: masuk - keluar,
        total_revenue: totalRevenue,
        toll_fee: tollFee,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

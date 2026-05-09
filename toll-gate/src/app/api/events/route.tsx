import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
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

export async function GET() {
  try {
    const result = await client.send(
      new ScanCommand({
        TableName: "tol_events",
      }),
    );

    const items = result.Items || [];

    // Hitung statistik
    const accepted = items.filter((i) => i.status === "DITERIMA");
    const masuk = accepted.filter((i) => i.tipe_gate === "MASUK").length;
    const keluar = accepted.filter((i) => i.tipe_gate === "KELUAR").length;

    // Urutkan terbaru di atas
    const sorted = items.sort(
      (a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime(),
    );

    return NextResponse.json({
      transactions: sorted.slice(0, 20),
      stats: {
        total_masuk: masuk,
        total_keluar: keluar,
        di_dalam: masuk - keluar,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

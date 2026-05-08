import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { NextApiRequest, NextApiResponse } from "next";

const TABLE_NAME = process.env.DYNAMODB_TRANSACTIONS_TABLE ?? "tol_events";
const AWS_REGION = process.env.AWS_REGION ?? "ap-southeast-1";

const client = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

interface TolEvent {
  uid: string;
  waktu: string;
  status: string;
  tipe_gate: string;
  alasan?: string;
  received_at?: string;
}

function toCSV(rows: TolEvent[]): string {
  if (rows.length === 0)
    return "uid,waktu,status,tipe_gate,alasan,received_at\n(tidak ada data)";

  const headers = ["uid", "waktu", "status", "tipe_gate", "alasan", "received_at"];
  const escape = (val: unknown) =>
    `"${String(val ?? "").replace(/"/g, '""')}"`;

  return [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => escape(row[h as keyof TolEvent])).join(",")
    ),
  ].join("\n");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("TABLE:", process.env.DYNAMODB_TRANSACTIONS_TABLE);
  console.log("REGION:", process.env.AWS_REGION);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { from, to, uid, limit } = req.query;
    const maxItems = Math.min(Number(limit) || 1000, 5000);

    const filterParts: string[] = [];
    const exprValues: Record<string, unknown> = {};
    const exprNames: Record<string, string> = {};

    if (from && typeof from === "string") {
      filterParts.push("#w >= :from");
      exprValues[":from"] = from;
      exprNames["#w"] = "waktu";
    }
    if (to && typeof to === "string") {
      filterParts.push("#w <= :to");
      exprValues[":to"] = to;
      if (!exprNames["#w"]) exprNames["#w"] = "waktu";
    }
    if (uid && typeof uid === "string") {
      filterParts.push("uid = :uid");
      exprValues[":uid"] = uid;
    }

    const command = new ScanCommand({
      TableName: TABLE_NAME,
      Limit: maxItems,
      ...(filterParts.length > 0 && {
        FilterExpression: filterParts.join(" AND "),
        ExpressionAttributeValues: exprValues,
        ExpressionAttributeNames:
          Object.keys(exprNames).length > 0 ? exprNames : undefined,
      }),
    });

    const result = await docClient.send(command);
    const items = (result.Items ?? []) as TolEvent[];

    items.sort((a, b) => (b.waktu ?? "").localeCompare(a.waktu ?? ""));

    const csv = toCSV(items);
    const filename = `tol_events_${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (error: unknown) {
    console.error("[/api/transactions/export] Error:", error);
    const message =
      process.env.NODE_ENV === "development"
        ? String(error)
        : "Gagal mengambil data dari DynamoDB.";
    return res.status(500).json({ error: message });
  }
}
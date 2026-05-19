import { dynamo, CARDS_TABLE } from "@/lib/dynamodb";
import { DeleteCommand, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { uid } = req.query;

  if (!uid || typeof uid !== "string") {
    return res.status(400).json({ error: "UID tidak valid." });
  }

  // ── DELETE: hapus kartu ────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    try {
      await dynamo.send(
        new DeleteCommand({ TableName: CARDS_TABLE, Key: { uid } })
      );
      return res.status(200).json({ deleted: uid });
    } catch (err) {
      console.error(`DELETE /api/cards/${uid} error:`, err);
      return res.status(500).json({ error: "Gagal menghapus kartu." });
    }
  }

  // ── PATCH: top-up saldo ────────────────────────────────────────────────────
  if (req.method === "PATCH") {
    const { jumlah } = req.body as { jumlah?: number };

    if (!jumlah || typeof jumlah !== "number" || jumlah <= 0) {
      return res.status(400).json({ error: "jumlah harus berupa angka positif." });
    }

    try {
      await dynamo.send(
        new UpdateCommand({
          TableName: CARDS_TABLE,
          Key: { uid },
          UpdateExpression: "SET saldo = saldo + :jumlah",
          ExpressionAttributeValues: { ":jumlah": jumlah },
          ConditionExpression: "attribute_exists(uid)",
        })
      );
      const result = await dynamo.send(
        new GetCommand({ TableName: CARDS_TABLE, Key: { uid } })
      );
      return res.status(200).json({ uid, saldo: result.Item?.saldo ?? 0 });
    } catch (err: any) {
      if (err?.name === "ConditionalCheckFailedException") {
        return res.status(404).json({ error: "Kartu tidak ditemukan." });
      }
      console.error(`PATCH /api/cards/${uid} error:`, err);
      return res.status(500).json({ error: "Gagal mengupdate saldo." });
    }
  }

  res.setHeader("Allow", ["DELETE", "PATCH"]);
  return res.status(405).json({ error: `Method ${req.method} tidak diizinkan.` });
}

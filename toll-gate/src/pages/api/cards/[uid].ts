import { dynamo, CARDS_TABLE } from "@/lib/dynamodb";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", ["DELETE"]);
    return res.status(405).json({ error: `Method ${req.method} tidak diizinkan.` });
  }

  const { uid } = req.query;

  if (!uid || typeof uid !== "string") {
    return res.status(400).json({ error: "UID tidak valid." });
  }

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

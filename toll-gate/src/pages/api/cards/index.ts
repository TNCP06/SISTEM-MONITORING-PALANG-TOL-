import { dynamo, CARDS_TABLE } from "@/lib/dynamodb";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ── GET: ambil semua kartu ─────────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const result = await dynamo.send(
        new ScanCommand({ TableName: CARDS_TABLE })
      );
      const items = (result.Items ?? []).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      return res.status(200).json(items);
    } catch (err) {
      console.error("GET /api/cards error:", err);
      return res.status(500).json({ error: "Gagal mengambil data kartu." });
    }
  }

  // ── POST: tambah kartu baru
  if (req.method === "POST") {
    const { uid, owner, status } = req.body as {
      uid?: string;
      owner?: string;
      status?: string;
    };

    if (!uid || !owner) {
      return res.status(400).json({ error: "uid dan owner wajib diisi." });
    }

    const newCard = {
      uid:    uid.trim().toUpperCase(),
      owner:  owner.trim(),
      status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      date:   new Date().toISOString().split("T")[0],
      saldo:  typeof req.body.saldo === "number" ? req.body.saldo : 200000,
    };

    try {
      await dynamo.send(new PutCommand({ TableName: CARDS_TABLE, Item: newCard }));
      return res.status(201).json(newCard);
    } catch (err) {
      console.error("POST /api/cards error:", err);
      return res.status(500).json({ error: "Gagal menyimpan kartu." });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: `Method ${req.method} tidak diizinkan.` });
}

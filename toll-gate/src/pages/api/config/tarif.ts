import { dynamo, CONFIG_TABLE } from "@/lib/dynamodb";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { NextApiRequest, NextApiResponse } from "next";

const CONFIG_KEY   = "tarif_flat";
const TARIF_MIN    = 500;
const TARIF_MAX    = 1_000_000;
const TARIF_DEFAULT = 5000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      const result = await dynamo.send(
        new GetCommand({ TableName: CONFIG_TABLE, Key: { config_key: CONFIG_KEY } }),
      );
      const tarif = result.Item ? Number(result.Item.value) : TARIF_DEFAULT;
      return res.status(200).json({ tarif });
    } catch (err) {
      console.error("GET /api/config/tarif error:", err);
      return res.status(500).json({ error: "Gagal mengambil konfigurasi tarif." });
    }
  }

  if (req.method === "PATCH") {
    const tarif = Number(req.body?.tarif);
    if (!Number.isInteger(tarif) || tarif < TARIF_MIN || tarif > TARIF_MAX) {
      return res.status(400).json({
        error: `Tarif harus bilangan bulat antara ${TARIF_MIN.toLocaleString("id-ID")} dan ${TARIF_MAX.toLocaleString("id-ID")}.`,
      });
    }
    try {
      await dynamo.send(
        new PutCommand({
          TableName: CONFIG_TABLE,
          Item: { config_key: CONFIG_KEY, value: tarif },
        }),
      );
      return res.status(200).json({ tarif });
    } catch (err) {
      console.error("PATCH /api/config/tarif error:", err);
      return res.status(500).json({ error: "Gagal menyimpan konfigurasi tarif." });
    }
  }

  res.setHeader("Allow", ["GET", "PATCH"]);
  return res.status(405).json({ error: `Method ${req.method} tidak diizinkan.` });
}

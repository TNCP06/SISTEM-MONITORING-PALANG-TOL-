import { createHash, timingSafeEqual } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

const COOKIE_NAME = "mgmt_auth";
const MAX_AGE     = 60 * 60 * 8; // 8 jam

function makeToken(): string {
  const secret = process.env.MANAGEMENT_PASSWORD ?? "";
  return createHash("sha256").update(`toll-gate:${secret}`).digest("hex");
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { password } = req.body ?? {};

    if (typeof password !== "string" || !password) {
      return res.status(400).json({ error: "Password diperlukan." });
    }

    const expected = process.env.MANAGEMENT_PASSWORD ?? "";
    const inputBuf  = Buffer.alloc(128, 0);
    const expectBuf = Buffer.alloc(128, 0);
    inputBuf.write(password, "utf8");
    expectBuf.write(expected, "utf8");

    if (!timingSafeEqual(inputBuf, expectBuf)) {
      return res.status(401).json({ error: "Password salah." });
    }

    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${makeToken()}; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}; Path=/${secure}`,
    );
    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET") {
    const token = req.cookies[COOKIE_NAME];
    const valid  = typeof token === "string" && token === makeToken();
    return res.status(valid ? 200 : 401).json({ authenticated: valid });
  }

  return res.status(405).end();
}

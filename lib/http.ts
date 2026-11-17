import { NextResponse } from "next/server";
import { db } from "./db";
import { sha256 } from "./auth";

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
export const notFound = () => json({ error: "not_found" }, 404);
export const bad = (msg: string, extra: Record<string, unknown> = {}) => json({ error: msg, ...extra }, 400);

/** Mutating routes require a same-origin Origin header and a JSON (or webp) body. */
export function checkOrigin(req: Request, contentType: "json" | "webp" | "none" = "json") {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!origin || !host) return json({ error: "bad_origin" }, 403);
  try { if (new URL(origin).host !== host) return json({ error: "bad_origin" }, 403); } catch { return json({ error: "bad_origin" }, 403); }
  const ct = req.headers.get("content-type") || "";
  if (contentType === "json" && !ct.includes("application/json")) return json({ error: "bad_content_type" }, 415);
  return null;
}

export function ipKey(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  return sha256(ip + (process.env.IP_HASH_SALT || "salt")).slice(0, 32);
}

/** Postgres token bucket, one atomic upsert per check. Returns a 429 response when over the limit. */
export async function rateLimit(key: string, cap: number, perSeconds: number) {
  const refill = cap / perSeconds;
  const rows = await db.query<{ tokens: number }>(
    `insert into rate_buckets (key, tokens, updated_at) values ($1, $2 - 1, now())
     on conflict (key) do update set
       tokens = least($2::real, rate_buckets.tokens + extract(epoch from now() - rate_buckets.updated_at)::real * $3::real) - 1,
       updated_at = now()
     returning tokens`,
    [key, cap, refill],
  );
  const tokens = rows[0]?.tokens ?? 0;
  if (tokens < 0) {
    const retry = Math.ceil(-tokens / refill);
    // give the token back so a denied request does not dig the hole deeper
    await db.query("update rate_buckets set tokens = tokens + 1 where key = $1", [key]);
    return json({ error: "rate_limited", message: "Thoda ruko, phir try karo" }, 429, { "Retry-After": String(retry) });
  }
  return null;
}

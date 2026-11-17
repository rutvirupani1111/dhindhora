import { createHash } from "node:crypto";
import { getActor, mintGuest } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkOrigin, json, rateLimit } from "@/lib/http";

/** Reads width/height from a VP8, VP8L or VP8X header. */
function webpSize(b: Buffer): [number, number] | null {
  if (b.length < 30 || b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (chunk === "VP8L") { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (chunk === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  return null;
}

export async function PUT(req: Request) {
  const o = checkOrigin(req, "none"); if (o) return o;
  if ((req.headers.get("content-type") || "") !== "image/webp") return json({ error: "unsupported_type" }, 415);
  const len = Number(req.headers.get("content-length") || 0);
  if (len > 65536) return json({ error: "too_large" }, 413);
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > 65536) return json({ error: "too_large" }, 413);
  const size = webpSize(buf);
  if (!size) return json({ error: "unsupported_type" }, 415);
  if (size[0] > 512 || size[1] > 512 || size[0] < 1 || size[1] < 1) return json({ error: "too_big_dimensions" }, 413);
  const a = (await getActor()) || (await mintGuest());
  const rl = await rateLimit("logo:" + a.id, 20, 3600); if (rl) return rl;
  const hash = createHash("sha256").update(buf).digest("hex");
  await db.query("insert into logos (hash, owner_id, webp, width, height) values ($1, $2, $3, $4, $5) on conflict (hash) do nothing", [hash, a.id, buf, size[0], size[1]]);
  return json({ hash, w: size[0], h: size[1] });
}

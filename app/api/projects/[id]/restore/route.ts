import { getActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkOrigin, json, notFound } from "@/lib/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = checkOrigin(req, "none"); if (o) return o;
  const { id } = await params;
  const a = await getActor(); if (!a) return notFound();
  const r = await db.query("update projects set deleted_at = null, updated_at = now() where id = $1 and owner_id = $2 and deleted_at > now() - interval '30 days' returning id", [id, a.id]);
  return r[0] ? json({ ok: true }) : notFound();
}

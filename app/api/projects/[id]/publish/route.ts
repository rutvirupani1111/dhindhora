import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad, checkOrigin, json, notFound, rateLimit } from "@/lib/http";
import { PublishSchema } from "@/lib/schema";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = checkOrigin(req); if (o) return o;
  const { id } = await params;
  const a = await getActor(); if (!a) return notFound();
  const p = PublishSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("invalid");
  if (p.data.visibility === "public" && (a.kind !== "member" || !p.data.ownsOrPermitted)) {
    return json({ error: "forbidden", message: a.kind !== "member" ? "Sabke liye daalne ke liye account chahiye" : "Ijaazat wala box tick karo" }, 403);
  }
  const rl = await rateLimit("publish:" + a.id, 10, 3600); if (rl) return rl;
  const r = await db.query<{ version: number }>(
    `update projects set visibility = $3, published_doc = doc, published_version = version, published_at = now()
      where id = $1 and owner_id = $2 and deleted_at is null returning version`,
    [id, a.id, p.data.visibility],
  );
  if (!r[0]) return notFound();
  revalidatePath(`/v/${id}`); revalidatePath(`/v/${id}/data.json`);
  return json({ ok: true, version: r[0].version, url: `/v/${id}` });
}

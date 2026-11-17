import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad, checkOrigin, ipKey, json, notFound, rateLimit } from "@/lib/http";
import { ReportSchema } from "@/lib/schema";

/** Three distinct reporters auto-hide a video pending review. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const o = checkOrigin(req); if (o) return o;
  const { id } = await params;
  const ip = ipKey(req);
  const rl = await rateLimit("report:ip:" + ip, 5, 3600); if (rl) return rl;
  const p = ReportSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return bad("invalid");
  const a = await getActor();
  const key = a?.id || ip;
  const exists = await db.query("select 1 from projects where id = $1 and visibility in ('unlisted','public') and deleted_at is null and hidden_at is null", [id]);
  if (!exists[0]) return notFound();
  const ins = await db.query("insert into reports (project_id, reporter_key, reason, note) values ($1, $2, $3, $4) on conflict do nothing returning id", [id, key, p.data.reason, p.data.note || null]);
  if (!ins[0]) return json({ error: "already_reported" }, 409);
  const [{ n }] = await db.query<{ n: number }>("select count(distinct reporter_key)::int as n from reports where project_id = $1 and resolved_at is null", [id]);
  if (n >= 3) {
    await db.query("update projects set hidden_at = now() where id = $1 and hidden_at is null", [id]);
    revalidatePath(`/v/${id}`); revalidatePath(`/v/${id}/data.json`);
  }
  return json({ ok: true });
}

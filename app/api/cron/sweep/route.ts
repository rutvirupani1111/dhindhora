import { db } from "@/lib/db";

/** Daily sweep. Every delete runs in batches of 1,000 rows until none remain. */
async function batched(sql: string) {
  let total = 0;
  for (let i = 0; i < 200; i++) {
    const r = await db.query(sql);
    total += r.length;
    if (r.length < 1000) break;
  }
  return total;
}

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("unauthorized", { status: 401 });
  const projects = await batched(
    "delete from projects where id in (select id from projects where deleted_at < now() - interval '30 days' limit 1000) returning id",
  );
  const logos = await batched(
    `delete from logos where hash in (select l.hash from logos l where l.created_at < now() - interval '7 days'
       and not exists (select 1 from projects p where p.deleted_at is null and (p.doc->'brief'->'logo'->>'hash' = l.hash or p.published_doc->'brief'->'logo'->>'hash' = l.hash)) limit 1000) returning hash`,
  );
  const guests = await batched(
    `delete from users where id in (select u.id from users u where u.kind = 'guest' and u.created_at < now() - interval '30 days'
       and not exists (select 1 from projects p where p.owner_id = u.id) limit 1000) returning id`,
  );
  const buckets = await batched("delete from rate_buckets where key in (select key from rate_buckets where updated_at < now() - interval '1 day' limit 1000) returning key");
  const sessions = await batched("delete from sessions where token_hash in (select token_hash from sessions where expires_at < now() limit 1000) returning token_hash");
  return Response.json({ projects, logos, guests, buckets, sessions });
}

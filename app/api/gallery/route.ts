import { db } from "@/lib/db";

export async function GET(req: Request) {
  const cursor = Number(new URL(req.url).searchParams.get("cursor") || 0);
  const rows = await db.query(
    `select id, title, is_demo, remix_count, aspect, style, published_doc as doc from projects
      where visibility = 'public' and featured and deleted_at is null and hidden_at is null
      order by is_demo desc, remix_count desc, published_at desc offset $1 limit 13`,
    [Math.max(0, cursor)],
  );
  return Response.json(
    { items: rows.slice(0, 12), next: rows.length > 12 ? cursor + 12 : null },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } },
  );
}

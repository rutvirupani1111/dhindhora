import { db } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  if (!/^[0-9a-f]{64}$/.test(hash)) return new Response("not found", { status: 404 });
  const r = await db.query<{ webp: Buffer }>("select webp from logos where hash = $1", [hash]);
  if (!r[0]) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(r[0].webp), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}

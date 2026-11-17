import { getShared } from "@/lib/share";

export const dynamic = "force-static";
export const dynamicParams = true;
export async function generateStaticParams() { return []; }

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getShared(id);
  if (!p) return Response.json({ error: "not_found" }, { status: 404 });
  const headers: Record<string, string> = {};
  if (p.visibility === "unlisted") headers["X-Robots-Tag"] = "noindex";
  return Response.json(p.doc, { headers });
}

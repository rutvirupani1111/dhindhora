import { notFound } from "next/navigation";
import { getActor, isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function Reports() {
  const a = await getActor();
  if (!isAdmin(a)) notFound();
  const rows = await db.query<{ id: number; project_id: string; reason: string; note: string | null; created_at: string; title: string; hidden_at: string | null; featured: boolean; n: number }>(
    `select r.id, r.project_id, r.reason, r.note, r.created_at, p.title, p.hidden_at, p.featured,
            (select count(*)::int from reports x where x.project_id = r.project_id and x.resolved_at is null) as n
       from reports r join projects p on p.id = r.project_id where r.resolved_at is null order by r.created_at desc limit 100`,
  );
  return (
    <div className="min-h-svh bg-dusk text-chai p-4">
      <h1 className="font-display text-[28px]">Report ki kataar</h1>
      {rows.length === 0 && <p>Koi report baaki nahi.</p>}
      <ul className="list-none p-0 flex flex-col gap-3 max-w-[760px]">
        {rows.map((r) => (
          <li key={r.id} className="bg-chai text-kohl border-2 border-kohl p-3 hard">
            <p className="m-0 font-bold"><a href={`/v/${r.project_id}`} className="text-peacock">{r.title}</a> ({r.n} report) {r.hidden_at ? "chhupa hua" : ""}</p>
            <p className="m-0">{r.reason}{r.note ? `: ${r.note}` : ""}</p>
            <AdminActions reportId={r.id} projectId={r.project_id} featured={r.featured} />
          </li>
        ))}
      </ul>
    </div>
  );
}

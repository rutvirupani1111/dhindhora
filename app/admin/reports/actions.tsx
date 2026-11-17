"use client";
import { useRouter } from "next/navigation";

export function AdminActions({ reportId, projectId, featured }: { reportId: number; projectId: string; featured: boolean }) {
  const router = useRouter();
  const act = async (id: string | number, action: string) => {
    await fetch(`/api/admin/reports/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    router.refresh();
  };
  return (
    <div className="flex gap-2 mt-2 flex-wrap">
      <button className="tin-btn chai" onClick={() => act(reportId, "kept")}>Rakho</button>
      <button className="tin-btn" onClick={() => act(reportId, "hidden")}>Chhupao</button>
      <button className="tin-btn mirchi" onClick={() => act(reportId, "deleted")}>Hatao</button>
      <button className="tin-btn kohl" onClick={() => act(projectId, featured ? "unfeature" : "feature")}>{featured ? "Gallery se hatao" : "Gallery mein lagao"}</button>
    </div>
  );
}

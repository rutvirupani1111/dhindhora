import { ImageResponse } from "next/og";
import { getShared } from "@/lib/share";
import { STYLES } from "@/packages/renderer/styles";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getShared(id);
  const st = STYLES[(p?.doc.style || "truck") as keyof typeof STYLES];
  const pins = p?.doc.brief.colors?.length ? p.doc.brief.colors : st.accents;
  const title = p ? p.title : "Dhindhora";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#2B1E2F", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ position: "absolute", bottom: 0, left: 560, width: 40, height: 140, background: "#3a2a3f", border: "4px solid #1B1A17" }} />
        <div style={{ display: "flex", flexDirection: "column", width: 980, height: 420, background: st.ground, border: "6px solid #1B1A17", boxShadow: "12px 12px 0 #1B1A17", padding: 48, position: "relative" }}>
          <div style={{ display: "flex", gap: 14 }}>
            {pins.slice(0, 3).map((c, i) => (<div key={i} style={{ width: 54, height: 54, borderRadius: 27, background: c, border: "4px solid #1B1A17" }} />))}
            <div style={{ marginLeft: "auto", color: st.ink, fontSize: 28, display: "flex" }}>{p?.doc.aspect || "9:16"}</div>
          </div>
          <div style={{ color: st.ink, fontSize: 92, lineHeight: 1.05, marginTop: 40, display: "flex" }}>{title.slice(0, 40)}</div>
          <div style={{ color: st.ink, fontSize: 32, marginTop: 18, display: "flex", opacity: 0.9 }}>{(p?.doc.brief.oneLiner || "Apni dukaan ka dhindhora peeto").slice(0, 80)}</div>
          {p?.is_demo ? <div style={{ position: "absolute", right: 40, bottom: 34, background: "#F2B705", color: "#1B1A17", fontSize: 26, padding: "6px 16px", display: "flex" }}>Demo: kaalpanik dukaan</div> : null}
          {Array.from({ length: 14 }).map((_, i) => (<div key={i} style={{ position: "absolute", top: -14, left: 20 + i * 68, width: 20, height: 20, borderRadius: 10, background: "#F2B705", border: "3px solid #1B1A17" }} />))}
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}

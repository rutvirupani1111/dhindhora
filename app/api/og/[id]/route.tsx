import { ImageResponse } from "next/og";
import { getShared } from "@/lib/share";
import { STYLES } from "@/packages/renderer/styles";

type Font = { name: string; data: ArrayBuffer; weight: 400; style: "normal" };
let fontCache: Promise<Font[]> | null = null;

/** Yatra One as one full TrueType file (Latin and Devanagari in the same face), which Satori reads.
 *  Asked without a browser user agent, Google Fonts answers with a single .ttf rather than per-script
 *  woff2 subsets; split subsets of one family made Satori fall back to its default sans. */
function signFonts(): Promise<Font[]> {
  if (!fontCache) {
    fontCache = (async () => {
      const ctl = AbortSignal.timeout(4000);
      const css = await fetch("https://fonts.googleapis.com/css2?family=Yatra+One", { signal: ctl }).then((r) => r.text());
      const url = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.(?:ttf|otf|woff))\)/)?.[1];
      if (!url) throw new Error("no font url");
      const data = await fetch(url, { signal: ctl }).then((r) => r.arrayBuffer());
      return [{ name: "Yatra One", data, weight: 400 as const, style: "normal" as const }];
    })().catch(() => { fontCache = null; return []; });
  }
  return fontCache;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, fonts] = await Promise.all([getShared(id), signFonts()]);
  const st = STYLES[(p?.doc.style || "truck") as keyof typeof STYLES];
  const pins = p?.doc.brief.colors?.length ? p.doc.brief.colors : st.accents;
  const title = (p ? p.title : "Dhindhora").slice(0, 40);
  const line = (p?.doc.brief.oneLiner || "Apni dukaan ka dhindhora peeto").slice(0, 80);
  const titlePx = title.length > 26 ? 70 : title.length > 16 ? 84 : 104;
  const face = fonts.length ? "Yatra One" : undefined;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#2B1E2F", alignItems: "center", justifyContent: "center", position: "relative", fontFamily: face }}>
        {/* the pole and a strip of lane floor */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 46, background: "#3a2a3f", borderTop: "4px solid #1B1A17", display: "flex" }} />
        <div style={{ position: "absolute", bottom: 40, left: 570, width: 44, height: 90, background: "#3a2a3f", border: "4px solid #1B1A17" }} />
        <div style={{ display: "flex", flexDirection: "column", width: 1000, height: 430, background: st.ground, border: "6px solid #1B1A17", boxShadow: "12px 12px 0 #1B1A17", padding: "44px 52px", position: "relative", marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {pins.slice(0, 3).map((c, i) => (<div key={i} style={{ width: 46, height: 46, borderRadius: 23, background: c, border: "4px solid #1B1A17" }} />))}
            <div style={{ marginLeft: "auto", color: st.ink, fontSize: 30, display: "flex", border: `3px solid ${st.ink}`, padding: "2px 14px" }}>{p?.doc.aspect || "9:16"}</div>
          </div>
          <div style={{ color: st.ink, fontSize: titlePx, lineHeight: 1.08, marginTop: 34, display: "flex", flexWrap: "wrap" }}>{title}</div>
          <div style={{ color: st.ink, fontSize: 34, lineHeight: 1.2, marginTop: 20, display: "flex", opacity: 0.92, maxWidth: p?.is_demo ? 560 : 880 }}>{line}</div>
          {p?.is_demo ? <div style={{ position: "absolute", right: 40, bottom: 34, background: "#F2B705", color: "#1B1A17", fontSize: 26, padding: "6px 16px", border: "3px solid #1B1A17", display: "flex" }}>Demo: kaalpanik dukaan</div> : null}
          {Array.from({ length: 14 }).map((_, i) => (<div key={i} style={{ position: "absolute", top: -14, left: 22 + i * 70, width: 20, height: 20, borderRadius: 10, background: "#F2B705", border: "3px solid #1B1A17" }} />))}
        </div>
        <div style={{ position: "absolute", left: 40, top: 28, color: "#F6E9D2", fontSize: 30, display: "flex" }}>{face ? "ढिंढोरा Dhindhora" : "Dhindhora"}</div>
      </div>
    ),
    { width: 1200, height: 630, fonts: fonts.length ? fonts : undefined, headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}

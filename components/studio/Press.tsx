"use client";
import { animate, motion, useMotionValue } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { totalMs } from "@/packages/renderer/frame";
import { PRESETS, handOff, probeFormat, renderVideo, type Preset, type Probe } from "@/lib/client/export";
import { loadStyleFonts } from "@/lib/client/fonts";
import { useStudio } from "@/lib/client/store";
import { logoFor } from "../DocCanvas";
import { useShell } from "../Shell";

export function Press({ id }: { id: string }) {
  const doc = useStudio((s) => s.doc)!;
  const version = useStudio((s) => s.version);
  const visibility = useStudio((s) => s.visibility);
  const publishedVersion = useStudio((s) => s.publishedVersion);
  const setMeta = useStudio((s) => s.setMeta);
  const { setDrum, beat, toast } = useShell();
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [prog, setProg] = useState<{ done: number; total: number; eta: number } | null>(null);
  const [cut30, setCut30] = useState(false);
  const [me, setMe] = useState<{ kind: string } | null>(null);
  const [owns, setOwns] = useState(false);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const crank = useMotionValue(0);
  const lastBeat = useRef(0);
  const total = totalMs(doc);

  useEffect(() => { probeFormat().then(setProbe); fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => null); }, []);

  const start = async () => {
    if (prog) { abort.current?.abort(); return; }
    if (!probe || probe.kind === "none") { toast(probe?.message || "Export nahi hoga"); return; }
    if (preset.id === "status" && total > 30000 && !cut30) { toast("Status 30 sec tak. Pehle 30 sec ya Reel preset chuno"); return; }
    await useStudio.getState().flush();
    await loadStyleFonts(doc.style);
    for (const s of doc.scenes) if (s.style) await loadStyleFonts(s.style);
    abort.current = new AbortController();
    setDrum("drum");
    setProg({ done: 0, total: 1, eta: 0 });
    try {
      const file = await renderVideo(doc, preset, probe, {
        signal: abort.current.signal, assets: { logo: logoFor(doc) }, maxMs: preset.id === "status" && cut30 ? 30000 : undefined,
        onProgress: (done, tot, eta) => {
          setProg({ done, total: tot, eta });
          crank.set((done / tot) * 360 * 6);
          if (done - lastBeat.current >= 10) { lastBeat.current = done; beat(); }
        },
      });
      setProg(null); setDrum("wave"); setTimeout(() => setDrum("idle"), 1200);
      const how = await handOff(file);
      await fetch(`/api/projects/${id}/exported`, { method: "POST" }).catch(() => null);
      setMeta({ status: "exported" });
      toast(how === "shared" ? "Share sheet khul gaya" : `${file.name} download ho gaya`);
    } catch (e) {
      setProg(null); setDrum("idle"); lastBeat.current = 0;
      animate(crank, 0, { duration: 0.3 });
      if ((e as Error).name !== "AbortError") toast("Render ruk gaya: " + (e as Error).message); else toast("Render roka. Kuch save nahi hua.");
    }
  };

  const publish = async (vis: "unlisted" | "public") => {
    setBusy(true);
    await useStudio.getState().flush();
    const r = await fetch(`/api/projects/${id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visibility: vis, ownsOrPermitted: owns }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { toast(j.message || (r.status === 404 ? "Pehle save hone do" : "Nahi hua")); return; }
    setMeta({ visibility: vis, publishedVersion: j.version });
    const url = location.origin + `/v/${id}`;
    try { await navigator.clipboard.writeText(url); toast("Link copy ho gaya"); } catch { toast("Link taiyaar: " + url); }
    setDrum("wave"); setTimeout(() => setDrum("idle"), 1200);
  };
  const unpublish = async () => {
    const r = await fetch(`/api/projects/${id}/unpublish`, { method: "POST" });
    if (r.ok) { setMeta({ visibility: "private", publishedVersion: null }); toast("Link band"); }
  };

  const pct = prog ? Math.round((prog.done / Math.max(1, prog.total)) * 100) : 0;
  const shareUrl = typeof location !== "undefined" ? `${location.origin}/v/${id}` : `/v/${id}`;
  const stale = visibility !== "private" && publishedVersion != null && publishedVersion !== version;
  return (
    <div className="min-h-[calc(100svh-100px)] bg-[#24301f] pb-44 pt-6 px-3">
      <div className="mx-auto max-w-[900px] grid gap-6 md:grid-cols-2">
        <section className="bg-[#2f5d3a] border-4 border-kohl hard-lg p-4 relative">
          <h2 className="m-0 font-display text-[26px] text-chai">Chhapakhana</h2>
          <p className={`mt-2 mb-3 px-2 py-1 font-bold border-2 border-kohl ${probe?.kind === "mp4" ? "bg-tota text-chai" : probe?.kind === "webm" ? "bg-haldi text-kohl" : "bg-mirchi text-chai"}`} role="status">{probe ? probe.message : "Dekh rahe hain ye browser kya banayega"}</p>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Preset">
            {PRESETS.map((p) => (
              <button key={p.id} role="radio" aria-checked={preset.id === p.id} onClick={() => setPreset(p)} disabled={!!prog}
                className={`min-h-[64px] border-2 border-kohl rounded-[10px] font-bold cursor-pointer ${preset.id === p.id ? "bg-haldi text-kohl hard" : "bg-tin text-kohl"}`}>
                {p.label}<span className="block mono text-[11px]">{p.w}x{p.h}</span>
              </button>
            ))}
          </div>
          {preset.id === "status" && total > 30000 && (
            <div className="mt-3 flex gap-2 flex-wrap">
              <button className="chip" aria-pressed={cut30} onClick={() => setCut30(true)}>Pehle 30 sec</button>
              <button className="chip" onClick={() => setPreset(PRESETS[1])}>Reel preset</button>
            </div>
          )}
          <div className="mt-5 flex items-center gap-4">
            {/* the crank lever: starts the render, tap again to cancel */}
            <button onClick={start} aria-label={prog ? "Render roko" : "Crank ghumao: render shuru"} className="relative w-[96px] h-[96px] rounded-full bg-kohl border-4 border-haldi cursor-pointer shrink-0">
              <motion.svg viewBox="0 0 96 96" className="absolute inset-0" style={{ rotate: crank }}>
                <circle cx="48" cy="48" r="10" fill="#F2B705" /><rect x="45" y="8" width="6" height="40" fill="#F2B705" /><circle cx="48" cy="10" r="9" fill="#D7261E" stroke="#1B1A17" strokeWidth="2" />
              </motion.svg>
            </button>
            <div className="flex-1">
              <p className="m-0 text-chai font-bold">{prog ? `${pct}%, ${Math.ceil(prog.eta)} sec baaki` : "Crank ghumao"}</p>
              <p className="m-0 text-chai/80 text-[15px] mono">{prog ? `${prog.done} / ${prog.total} frame` : `${(Math.min(total, preset.id === "status" && cut30 ? 30000 : total) / 1000).toFixed(1)}s, 30 fps, bina awaaz`}</p>
              {prog && <button className="tin-btn mirchi mt-2" onClick={start}>Roko</button>}
            </div>
          </div>
          {/* printed frames roll out as a paper strip */}
          <div className="mt-4 h-10 bg-chai border-2 border-kohl overflow-hidden" aria-hidden>
            <div className="h-full bg-[repeating-linear-gradient(90deg,var(--kohl)_0_2px,transparent_2px_28px)] transition-[width] duration-150" style={{ width: `${pct}%` }} />
          </div>
        </section>

        <section className="bg-chai text-kohl border-4 border-kohl hard-lg p-4">
          <h2 className="m-0 font-display text-[24px]">Link bhejo</h2>
          <p className="mt-1 mb-3 text-[15px]">Link seedha JSON se chalti hai, 10 KB ke aas paas. Koi 12 MB ka forward nahi.</p>
          {visibility !== "private" && (
            <div className="mb-3 p-2 border-2 border-kohl bg-white/50">
              <p className="m-0 font-bold">{visibility === "public" ? "Sabke liye" : "Link wale"}</p>
              <a className="text-peacock break-all" href={`/v/${id}`} target="_blank" rel="noopener">{shareUrl}</a>
              {stale && <p className="m-0 mt-1 text-mirchi font-bold">Link pe purana version hai</p>}
              <div className="flex gap-2 mt-2 flex-wrap">
                {stale && <button className="tin-btn" disabled={busy} onClick={() => publish(visibility as "unlisted" | "public")}>Phir se chhapo</button>}
                <a className="tin-btn chai" href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener">WhatsApp pe bhejo</a>
                <button className="tin-btn chai" onClick={unpublish}>Link band karo</button>
              </div>
            </div>
          )}
          <button className="tin-btn w-full" disabled={busy} onClick={() => publish("unlisted")}>Link wala (sirf jinke paas link hai)</button>
          <div className="mt-4 border-t-2 border-kohl pt-3">
            <p className="m-0 font-bold">Sabke liye</p>
            {me?.kind !== "member" ? (
              <p className="m-0 mt-1 text-[15px]">Phone badla toh video kho jayegi. <Link href={`/signin?next=/studio/${id}?at=press`} className="text-peacock font-bold">Account se jod lo</Link>, phir sabke liye daal sakte ho.</p>
            ) : (
              <>
                <label className="flex items-start gap-2 min-h-[44px] mt-1"><input type="checkbox" className="w-5 h-5 mt-1" checked={owns} onChange={(e) => setOwns(e.target.checked)} />Ye meri dukaan hai, ya maalik ki ijaazat hai.</label>
                <button className="tin-btn kohl mt-1" disabled={!owns || busy} onClick={() => publish("public")}>Sabke liye chhapo</button>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

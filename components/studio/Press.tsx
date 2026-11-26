"use client";
import { animate, motion, useMotionValue } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { coverTime, totalMs } from "@/packages/renderer/frame";
import { PRESETS, handOff, probeFormat, renderVideo, type Preset, type Probe } from "@/lib/client/export";
import { loadStyleFonts } from "@/lib/client/fonts";
import { useStudio } from "@/lib/client/store";
import { DocCanvas, logoFor } from "../DocCanvas";
import { useShell } from "../Shell";

export function Press({ id, onOpenBooth }: { id: string; onOpenBooth: () => void }) {
  const doc = useStudio((s) => s.doc)!;
  const version = useStudio((s) => s.version);
  const visibility = useStudio((s) => s.visibility);
  const publishedVersion = useStudio((s) => s.publishedVersion);
  const setMeta = useStudio((s) => s.setMeta);
  const { setDrum, beat, toast, lang } = useShell();
  const en = lang === "en";
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [prog, setProg] = useState<{ done: number; total: number; eta: number } | null>(null);
  const [cut30, setCut30] = useState(false);
  const [me, setMe] = useState<{ kind: string } | null>(null);
  const [owns, setOwns] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const abort = useRef<AbortController | null>(null);
  const crank = useMotionValue(0);
  const lastBeat = useRef(0);
  const total = totalMs(doc);
  // one single-scene doc per scene, kept stable so the strip's canvases draw once, not on every progress tick
  const strip = useMemo(() => doc.scenes.map((s) => ({ ...doc, scenes: [s] })), [doc]);

  useEffect(() => { probeFormat().then(setProbe); fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => null); }, []);
  // the paper strip and the drummer stop if the person leaves mid-render
  useEffect(() => () => abort.current?.abort(), []);

  const start = async () => {
    if (prog) { abort.current?.abort(); return; }
    if (!probe || probe.kind === "none") { toast(probe?.message || "Export nahi hoga"); return; }
    if (preset.id === "status" && total > 30000 && !cut30) { toast(en ? "Status takes 30 s. Pick First 30 s or the Reel preset" : "Status 30 sec tak. Pehle 30 sec ya Reel preset chuno"); return; }
    setFile(null);
    await useStudio.getState().flush();
    await loadStyleFonts(doc.style);
    for (const s of doc.scenes) if (s.style) await loadStyleFonts(s.style);
    abort.current = new AbortController();
    setDrum("drum");
    lastBeat.current = 0;
    setProg({ done: 0, total: 1, eta: 0 });
    try {
      const out = await renderVideo(doc, preset, probe, {
        signal: abort.current.signal, assets: { logo: logoFor(doc) }, maxMs: preset.id === "status" && cut30 ? 30000 : undefined,
        onProgress: (done, tot, eta) => {
          setProg({ done, total: tot, eta });
          crank.set((done / tot) * 360 * 6);
          // one stick beat per 10 frames encoded: his tempo is the real encode rate
          if (done - lastBeat.current >= 10) { lastBeat.current = done; beat(); }
        },
      });
      setProg(null); setDrum("wave"); setTimeout(() => setDrum("idle"), 1200);
      setFile(out);
      const how = await handOff(out);
      await fetch(`/api/projects/${id}/exported`, { method: "POST" }).catch(() => null);
      setMeta({ status: "exported" });
      toast(how === "shared" ? (en ? "Share sheet opened" : "Share sheet khul gaya") : `${out.name} ${en ? "downloaded" : "download ho gaya"}`);
    } catch (e) {
      setProg(null); setDrum("idle"); lastBeat.current = 0;
      animate(crank, 0, { duration: 0.3 });
      if ((e as Error).name !== "AbortError") toast((en ? "Render stopped: " : "Render ruk gaya: ") + (e as Error).message);
      else toast(en ? "Render cancelled. Nothing was saved." : "Render roka. Kuch save nahi hua.");
    }
  };

  const publish = async (vis: "unlisted" | "public") => {
    setBusy(true);
    await useStudio.getState().flush();
    const r = await fetch(`/api/projects/${id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visibility: vis, ownsOrPermitted: owns }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { toast(j.message || (r.status === 404 ? (en ? "Let it save first" : "Pehle save hone do") : (en ? "Did not work" : "Nahi hua"))); return; }
    setMeta({ visibility: vis, publishedVersion: j.version });
    const url = location.origin + `/v/${id}`;
    try { await navigator.clipboard.writeText(url); toast(en ? "Link copied" : "Link copy ho gaya"); } catch { toast((en ? "Link ready: " : "Link taiyaar: ") + url); }
    setDrum("wave"); setTimeout(() => setDrum("idle"), 1200);
  };
  const unpublish = async () => {
    const r = await fetch(`/api/projects/${id}/unpublish`, { method: "POST" });
    if (r.ok) { setMeta({ visibility: "private", publishedVersion: null }); toast(en ? "Link closed" : "Link band"); }
  };
  const copy = async (url: string) => { try { await navigator.clipboard.writeText(url); toast(en ? "Link copied" : "Link copy ho gaya"); } catch { toast(url); } };

  const pct = prog ? Math.round((prog.done / Math.max(1, prog.total)) * 100) : 0;
  const shareUrl = typeof location !== "undefined" ? `${location.origin}/v/${id}` : `/v/${id}`;
  const stale = visibility !== "private" && publishedVersion != null && publishedVersion !== version;
  const shownMs = Math.min(total, preset.id === "status" && cut30 ? 30000 : total);
  return (
    <div className="min-h-[calc(100svh-100px)] bg-[#24301f] pb-40 pt-5 px-3">
      <p className="mx-auto max-w-[900px] m-0 mb-4 text-chai text-[15px]">
        {en ? "Two ways to send it. Pick one, or do both." : "Bhejne ke do raaste. Ek chuno, ya dono."}{" "}
        <button className="underline decoration-haldi decoration-2 underline-offset-4 bg-transparent border-0 text-chai cursor-pointer min-h-[44px]" onClick={onOpenBooth}>{en ? "← Back to editing" : "← Abhi aur sajana hai"}</button>
      </p>
      <div className="mx-auto max-w-[900px] grid gap-6 md:grid-cols-2">
        <section className="bg-[#2f5d3a] border-4 border-kohl hard-lg p-4 relative" aria-labelledby="press-file">
          <h2 id="press-file" className="m-0 font-display text-[24px] text-chai leading-tight"><span className="font-poster text-haldi mr-2">A</span>{en ? "Make a video file" : "Video file banao"}</h2>
          <p className="m-0 mt-1 text-chai/90 text-[15px]">{en ? "For WhatsApp Status, Reels and Shorts. Silent, no watermark." : "WhatsApp Status, Reels, Shorts ke liye. Bina awaaz, bina watermark."}</p>
          <p className={`mt-3 mb-3 px-2 py-1 font-bold border-2 border-kohl ${probe?.kind === "mp4" ? "bg-tota text-chai" : probe?.kind === "webm" ? "bg-haldi text-kohl" : probe ? "bg-mirchi text-chai" : "bg-chai text-kohl"}`} role="status">{probe ? probe.message : (en ? "Checking what this browser can make" : "Dekh rahe hain ye browser kya banayega")}</p>
          <p className="m-0 mb-1 text-chai text-[15px] font-bold">{en ? "Where will you post it?" : "Kahan daaloge?"}</p>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Preset">
            {PRESETS.map((p) => (
              <button key={p.id} role="radio" aria-checked={preset.id === p.id} onClick={() => setPreset(p)} disabled={!!prog}
                className={`min-h-[64px] px-1 border-2 border-kohl rounded-[10px] font-bold cursor-pointer leading-tight ${preset.id === p.id ? "bg-haldi text-kohl hard" : "bg-tin text-kohl"}`}>
                {p.label}<span className="block text-[11px] font-medium">{en ? p.useEn : p.use}</span>
              </button>
            ))}
          </div>
          {preset.id === "status" && total > 30000 && (
            <div className="mt-3 flex gap-2 flex-wrap">
              <button className="chip" aria-pressed={cut30} onClick={() => setCut30(true)}>{en ? "First 30 s" : "Pehle 30 sec"}</button>
              <button className="chip" onClick={() => setPreset(PRESETS[1])}>{en ? "Reel preset" : "Reel preset"}</button>
            </div>
          )}
          <div className="mt-5 flex items-center gap-4">
            {/* the crank lever: starts the render, tap again to cancel */}
            {/* a green cast-iron hand press: the wheel turns with the real encode progress */}
            <button onClick={start} aria-label={prog ? (en ? "Stop the render" : "Render roko") : (en ? "Turn the crank: make the video" : "Crank ghumao: video banao")} className="relative w-[112px] h-[100px] bg-transparent border-0 p-0 cursor-pointer shrink-0">
              <svg viewBox="0 0 112 100" className="absolute inset-0" aria-hidden>
                <rect x="6" y="88" width="100" height="10" fill="#1B1A17" />
                <path d="M16 88 L22 40 Q24 30 34 30 H70 Q80 30 82 40 L88 88 Z" fill="#1F5A3A" stroke="#1B1A17" strokeWidth="3" />
                <path d="M26 82 L30 46 M78 82 L74 46" stroke="#2F7A50" strokeWidth="3" />
                <rect x="28" y="56" width="48" height="12" rx="6" fill="#8C8A85" stroke="#1B1A17" strokeWidth="2" />
                <path d="M30 62 h44" stroke="#77756f" strokeWidth="2" />
                <rect x="34" y="70" width="36" height="6" fill="#F6E9D2" stroke="#1B1A17" strokeWidth="1.5" />
                <circle cx="52" cy="30" r="5" fill="#F2B705" stroke="#1B1A17" strokeWidth="2" />
              </svg>
              <motion.svg viewBox="0 0 48 48" className="absolute right-0 top-2 w-[46px] h-[46px]" style={{ rotate: crank }} aria-hidden>
                <circle cx="24" cy="24" r="19" fill="none" stroke="#1B1A17" strokeWidth="7" />
                <circle cx="24" cy="24" r="19" fill="none" stroke="#F2B705" strokeWidth="4" />
                <path d="M24 6 V42 M6 24 H42" stroke="#F2B705" strokeWidth="3" />
                <circle cx="24" cy="24" r="5" fill="#D7261E" stroke="#1B1A17" strokeWidth="2" />
                <circle cx="24" cy="5" r="4.5" fill="#D7261E" stroke="#1B1A17" strokeWidth="2" />
              </motion.svg>
            </button>
            <div className="flex-1 min-w-0">
              {prog ? (
                <>
                  <p className="m-0 text-chai font-bold">{pct}%, {Math.ceil(prog.eta)} {en ? "s left" : "sec baaki"}</p>
                  <p className="m-0 text-chai/80 text-[13px] mono">{prog.done} / {prog.total} frame</p>
                  <button className="tin-btn mirchi mt-2" onClick={start}>{en ? "Stop" : "Roko"}</button>
                </>
              ) : (
                <>
                  <button className="tin-btn mirchi text-[18px]" onClick={start} disabled={!probe || probe.kind === "none"}>{en ? "Make the video" : "Video banao"}</button>
                  <p className="m-0 mt-1 text-chai/80 text-[13px] mono">{(shownMs / 1000).toFixed(1)}s, 30 fps, {en ? "silent" : "bina awaaz"}</p>
                </>
              )}
            </div>
          </div>
          {/* printed frames roll out as a paper strip */}
          {/* the strip holds every scene's real frame; blank paper slides off it as frames are encoded */}
          <div className="mt-4 h-[58px] bg-chai border-2 border-kohl overflow-hidden relative" aria-hidden>
            <div className="absolute inset-0 flex gap-1 p-1">
              {strip.map((d) => (
                <div key={d.scenes[0].id} className="h-full shrink-0 border border-kohl bg-kohl" style={{ aspectRatio: d.aspect.replace(":", "/") }}>
                  <DocCanvas doc={d} t={Math.min(d.scenes[0].durMs - 50, 1500)} detail={0} />
                </div>
              ))}
            </div>
            <div className="absolute inset-0 bg-[var(--paper)] bg-[repeating-linear-gradient(90deg,transparent_0_27px,rgba(27,26,23,.18)_27px_28px)] transition-transform duration-150 ease-out"
              style={{ transform: `translateX(${file && !prog ? 100 : pct}%)` }} />
          </div>
          {file && !prog && (
            <div className="mt-3 bg-chai text-kohl border-2 border-kohl px-3 py-2">
              <p className="m-0 font-bold">{en ? "Done: " : "Ho gaya: "}<span className="mono text-[13px] break-all">{file.name}</span> <span className="text-[13px]">({(file.size / 1048576).toFixed(1)} MB)</span></p>
              <button className="tin-btn chai mt-2" onClick={() => handOff(file)}>{en ? "Share or save again" : "Phir se share / save karo"}</button>
            </div>
          )}
        </section>

        <section className="bg-chai text-kohl border-4 border-kohl hard-lg p-4" aria-labelledby="press-link">
          <h2 id="press-link" className="m-0 font-display text-[24px] leading-tight"><span className="font-poster text-mirchi mr-2">B</span>{en ? "Or send a link" : "Ya link bhejo"}</h2>
          <p className="mt-1 mb-3 text-[15px]">{en ? "The link plays the video instantly from about 10 KB of data. No 12 MB forward." : "Link pe video turant chalti hai, sirf 10 KB ke aas paas. Koi 12 MB ka forward nahi."}</p>
          <div className="flex gap-3 items-start mb-3">
            <div className="w-[84px] shrink-0 border-2 border-kohl bg-kohl"><DocCanvas doc={doc} t={coverTime(doc)} detail={0} label={en ? "Cover" : "Cover frame"} /></div>
            <p className="m-0 text-[13px]">{en ? "Only people with the link can see it. Later edits stay off the link until you print again." : "Sirf link wale dekh payenge. Baad ke badlaav link pe tab aayenge jab phir se chhapoge."}</p>
          </div>
          {visibility !== "private" && (
            <div className="mb-3 p-2 border-2 border-kohl bg-white/50">
              <p className="m-0 font-bold">{visibility === "public" ? (en ? "Public" : "Sabke liye") : (en ? "Link only" : "Link wale")}</p>
              <a className="text-peacock break-all" href={`/v/${id}`} target="_blank" rel="noopener">{shareUrl}</a>
              {stale && <p className="m-0 mt-1 text-mirchi font-bold">{en ? "The link shows an older version" : "Link pe purana version hai"}</p>}
              <div className="flex gap-2 mt-2 flex-wrap">
                {stale && <button className="tin-btn" disabled={busy} onClick={() => publish(visibility as "unlisted" | "public")}>{en ? "Print again" : "Phir se chhapo"}</button>}
                <button className="tin-btn chai" onClick={() => copy(shareUrl)}>{en ? "Copy link" : "Link copy karo"}</button>
                <a className="tin-btn chai" href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener">{en ? "Send on WhatsApp" : "WhatsApp pe bhejo"}</a>
                <button className="tin-btn chai" onClick={unpublish}>{en ? "Close the link" : "Link band karo"}</button>
              </div>
            </div>
          )}
          {visibility === "private" && <button className="tin-btn w-full" disabled={busy} onClick={() => publish("unlisted")}>{en ? "Make a link" : "Link banao"}</button>}
          <div className="mt-4 border-t-2 border-kohl pt-3">
            <p className="m-0 font-bold">{en ? "Public (optional)" : "Sabke liye (chaho toh)"}</p>
            {me?.kind !== "member" ? (
              <p className="m-0 mt-1 text-[15px]">{en ? "If you change phones, an account keeps your shops. " : "Phone badla toh video kho jayegi. "}<Link href={`/signin?next=/studio/${id}?at=press`} className="text-peacock font-bold">{en ? "Join with an account" : "Account se jod lo"}</Link>{en ? ", then you can make it public and let others remix it." : ", phir sabke liye daal sakte ho aur log remix kar payenge."}</p>
            ) : (
              <>
                <label className="flex items-start gap-2 min-h-[44px] mt-1"><input type="checkbox" className="w-5 h-5 mt-1" checked={owns} onChange={(e) => setOwns(e.target.checked)} />{en ? "This is my shop, or I have the owner's permission." : "Ye meri dukaan hai, ya maalik ki ijaazat hai."}</label>
                <button className="tin-btn kohl mt-1" disabled={!owns || busy} onClick={() => publish("public")}>{en ? "Publish for everyone" : "Sabke liye chhapo"}</button>
              </>
            )}
          </div>
        </section>
      </div>

      {/* the press bar: says what is happening, the drummer stands at its left */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-kohl border-t-4 border-haldi">
        <div className="mx-auto max-w-[900px] flex items-center gap-3 pl-[84px] pr-3 py-2 min-h-[76px]">
          <p className="m-0 flex-1 min-w-0 text-chai text-[15px] leading-tight" role="status">
            {prog ? (en ? `Printing: ${pct}%. Tap the crank to stop.` : `Chhap raha hai: ${pct}%. Rokna ho toh crank dabao.`)
              : file ? (en ? "Done. The file is on your phone." : "Ho gaya. File phone pe hai.")
              : visibility !== "private" ? (en ? "Your link is live." : "Aapka link chalu hai.")
              : (en ? "Make the file, send the link, or both." : "File banao ya link bhejo. Dono bhi chalega.")}
          </p>
          <button className="tin-btn chai shrink-0" onClick={onOpenBooth}>{en ? "← 3. Edit" : "← 3. Sajao"}</button>
        </div>
      </div>
    </div>
  );
}

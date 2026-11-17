"use client";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Doc } from "@/packages/renderer/core";
import { migrate } from "@/packages/renderer/core";
import { coverTime } from "@/packages/renderer/frame";
import { idb } from "@/lib/client/idb";
import { blankDoc } from "@/lib/client/newdoc";
import { useStudio } from "@/lib/client/store";
import { DocCanvas } from "../DocCanvas";
import { useShell } from "../Shell";
import { Board } from "./Board";
import { Booth } from "./Booth";
import { Parchi } from "./Parchi";
import { Press } from "./Press";

export type At = "parchi" | "board" | "booth" | "press";
const PLACES: { at: At; label: string; en: string }[] = [
  { at: "parchi", label: "Parchi", en: "Brief" },
  { at: "board", label: "Deewar", en: "Wall" },
  { at: "booth", label: "Tambu", en: "Editor" },
  { at: "press", label: "Chhapakhana", en: "Export" },
];

export function Studio({ id, initialAt }: { id: string; initialAt: At }) {
  const router = useRouter();
  const sp = useSearchParams();
  const { setDrum, lang, toast } = useShell();
  const doc = useStudio((s) => s.doc);
  const sync = useStudio((s) => s.sync);
  const conflict = useStudio((s) => s.conflict);
  const [at, setAtS] = useState<At>(initialAt);
  const [bahi, setBahi] = useState(false);
  const [rects, setRects] = useState<Record<string, DOMRect> | null>(null);

  const setAt = (a: At) => { setAtS(a); router.replace(`/studio/${id}?at=${a}`, { scroll: false }); };
  useEffect(() => { const a = sp.get("at") as At | null; if (a && a !== at) setAtS(a); }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps

  // first paint from IndexedDB, server copy reconciles in the background
  useEffect(() => {
    let alive = true;
    (async () => {
      const local = await idb.getDoc(id);
      const st = useStudio.getState();
      if (local && alive) await st.load(id, migrate(local.doc), local.version, local.base, { visibility: local.visibility, status: local.status, publishedVersion: local.publishedVersion });
      const r = await fetch(`/api/projects/${id}`).catch(() => null);
      if (!alive) return;
      if (r?.ok) {
        const j = await r.json();
        const meta = { visibility: j.visibility, status: j.status, publishedVersion: j.published_version };
        if (!local || (!local.dirty && j.version >= local.version)) await useStudio.getState().load(id, migrate(j.doc), j.version, j.doc, meta);
        else { useStudio.getState().setMeta(meta); if (local.dirty) { useStudio.setState({ sync: "local" }); useStudio.getState().flush(); } }
      } else if (!local) {
        await useStudio.getState().load(id, blankDoc(), 0, null);
      } else if (local.dirty) { useStudio.setState({ sync: "local" }); useStudio.getState().flush(); }
    })();
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    const ok = () => { setDrum("nod"); setTimeout(() => setDrum("idle"), 600); };
    const off = () => { setDrum("shrug", "Phone pe rakh liya, net aate hi bhej denge"); setTimeout(() => setDrum("idle"), 2400); };
    window.addEventListener("dh-saved", ok); window.addEventListener("dh-offline", off);
    return () => { window.removeEventListener("dh-saved", ok); window.removeEventListener("dh-offline", off); };
  }, [setDrum]);

  // global keys: undo / redo
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (tgt.closest("input,textarea,[contenteditable=true]")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) useStudio.getState().redo(); else useStudio.getState().undo(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const sign = sync === "sent" || sync === "idle" ? { t: "Bhej diya", c: "bg-tota text-chai" } : sync === "sending" ? { t: "Bhej rahe hain", c: "bg-chai text-kohl" } : sync === "failed" ? { t: "Phir bhejo", c: "bg-mirchi text-chai" } : sync === "conflict" ? { t: "Do version", c: "bg-genda text-kohl" } : { t: "Phone pe rakh liya", c: "bg-haldi text-kohl" };

  if (!doc) {
    return (
      <div className="min-h-svh tent grid place-items-center p-4">
        <div className="w-[min(92vw,420px)] aspect-[9/16] shutter-steel border-4 border-kohl" aria-label="Dukaan khul rahi hai" />
      </div>
    );
  }
  const goBoard = (r: Record<string, DOMRect>) => { setRects(r); setAt("board"); };

  return (
    <div className="min-h-svh bg-dusk text-chai">
      <header className="sticky top-0 z-30 bg-kohl border-b-4 border-haldi">
        <div className="flex items-center gap-2 px-3 py-2">
          <Link href="/" className="font-display text-[22px] text-chai no-underline min-h-[44px] flex items-center" aria-label="Gali mein wapas">ढिं</Link>
          <h1 className="m-0 font-display text-[clamp(18px,4.6vw,24px)] truncate flex-1" style={{ viewTransitionName: `title-${id}` }}>{doc.brief.name || "Nayi dukaan"}</h1>
          <button className={`min-h-[44px] px-2 border-2 border-chai text-[15px] font-bold ${sign.c}`} onClick={() => { if (sync === "failed") useStudio.getState().flush(); else setBahi(true); }} aria-label={`${sign.t}. Bahi kholo`}>{sign.t}</button>
        </div>
        <nav className="flex overflow-x-auto no-scrollbar" aria-label="Studio ki jagah">
          {PLACES.map((p) => (
            <button key={p.at} onClick={() => setAt(p.at)} aria-current={at === p.at ? "page" : undefined}
              className={`flex-1 min-h-[44px] min-w-[84px] px-2 font-bold border-0 border-r-2 border-dusk cursor-pointer ${at === p.at ? "bg-haldi text-kohl" : "bg-kohl text-chai"}`}>
              {lang === "en" ? p.en : p.label}
            </button>
          ))}
        </nav>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.main key={at} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34 }}>
          {at === "parchi" && <Parchi onMade={goBoard} />}
          {at === "board" && <Board rects={rects} onClearRects={() => setRects(null)} onOpenBooth={() => setAt("booth")} onOpenParchi={() => setAt("parchi")} />}
          {at === "booth" && <Booth onOpenPress={() => setAt("press")} onOpenBahi={() => setBahi(true)} />}
          {at === "press" && <Press id={id} />}
        </motion.main>
      </AnimatePresence>

      {bahi && <Bahi onClose={() => setBahi(false)} />}
      {conflict && <ConflictSheet mine={conflict.mine} theirs={conflict.theirs} onPick={(k) => { useStudio.getState().resolveConflict(k); toast(k === "mine" ? "Phone wala rakha" : "Server wala rakha"); }} />}
    </div>
  );
}

/** Munim ji's Bahi: a ledger of named edits; tap a line to jump there. */
function Bahi({ onClose }: { onClose: () => void }) {
  const past = useStudio((s) => s.past);
  const future = useStudio((s) => s.future);
  const sync = useStudio((s) => s.sync);
  return (
    <div className="fixed inset-0 z-50 bg-kohl/60" onClick={onClose}>
      <div role="dialog" aria-label="Munim ji ki Bahi" onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 max-h-[70svh] overflow-y-auto bg-[#8f1d1d] border-t-4 border-kohl p-3">
        <div className="paper-lines border-2 border-kohl p-3 text-kohl">
          <div className="flex items-center justify-between mb-2"><h2 className="m-0 font-display text-[24px]">Munim ji ki Bahi</h2><button className="tin-btn chai" onClick={onClose}>Band</button></div>
          {past.length === 0 && <p className="m-0">Abhi koi likhawat nahi.</p>}
          <ol className="m-0 p-0 list-none">
            {past.map((e, i) => (
              <li key={i} className="flex items-center gap-2 border-b border-[rgba(0,112,122,.25)]">
                <button className="flex-1 min-h-[44px] text-left bg-transparent border-0 cursor-pointer" onClick={() => { useStudio.getState().jump(i); onClose(); }}>
                  <span className="mono text-[13px] mr-2">{String(i + 1).padStart(3, "0")}</span>{e.label}
                </button>
                {e.confirmed ? <span className="text-tota font-bold" aria-label="Server ne maan liya">✓</span> : e.failed ? <button className="chip text-mirchi" onClick={() => useStudio.getState().flush()}>Phir bhejo</button> : <span className="text-[13px]">{sync === "sending" ? "..." : "phone pe"}</span>}
              </li>
            ))}
            <li className="min-h-[44px] flex items-center font-bold">Abhi yahan</li>
            {future.map((e, i) => <li key={"f" + i} className="min-h-[36px] flex items-center opacity-50 line-through">{e.label}</li>)}
          </ol>
        </div>
      </div>
    </div>
  );
}

function ConflictSheet({ mine, theirs, onPick }: { mine: Doc; theirs: Doc; onPick: (k: "mine" | "theirs") => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-kohl/70">
      <div role="dialog" aria-label="Do version" className="absolute inset-x-0 bottom-0 bg-chai text-kohl border-t-4 border-kohl p-4">
        <p className="m-0 mb-3 font-bold">Isi scene ko do jagah badla gaya. Kaunsa rakhein?</p>
        <div className="grid grid-cols-2 gap-3">
          {([["mine", mine, "Phone wala rakho"], ["theirs", theirs, "Server wala rakho"]] as const).map(([k, d, l]) => (
            <div key={k} className="flex flex-col gap-2">
              <div className="border-2 border-kohl"><DocCanvas doc={d} t={coverTime(d)} detail={0} /></div>
              <button className="tin-btn" onClick={() => onPick(k)}>{l}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

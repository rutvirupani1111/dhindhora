"use client";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Doc } from "@/packages/renderer/core";
import { STYLE_ORDER, migrate } from "@/packages/renderer/core";
import { STYLES } from "@/packages/renderer/styles";
import { coverTime } from "@/packages/renderer/frame";
import { idb } from "@/lib/client/idb";
import { blankDoc } from "@/lib/client/newdoc";
import { reshuffle } from "@/lib/client/edit";
import { useStudio } from "@/lib/client/store";
import { DocCanvas } from "../DocCanvas";
import { useShell } from "../Shell";
import { Board } from "./Board";
import { Booth } from "./Booth";
import { Parchi } from "./Parchi";
import { Press } from "./Press";

export type At = "parchi" | "board" | "booth" | "press";
/** Four numbered steps. The verb says what you do there; the place name is the world's name for it. */
const PLACES: { at: At; verb: string; en: string; place: string; placeEn: string }[] = [
  { at: "parchi", verb: "Likho", en: "Write", place: "parchi", placeEn: "brief" },
  { at: "board", verb: "Dekho", en: "Review", place: "deewar", placeEn: "wall" },
  { at: "booth", verb: "Sajao", en: "Edit", place: "tambu", placeEn: "booth" },
  { at: "press", verb: "Bhejo", en: "Send", place: "chhapakhana", placeEn: "press" },
];

export function Studio({ id, initialAt }: { id: string; initialAt: At }) {
  const router = useRouter();
  const sp = useSearchParams();
  const { setDrum, lang, toast } = useShell();
  const doc = useStudio((s) => s.doc);
  const sync = useStudio((s) => s.sync);
  const conflict = useStudio((s) => s.conflict);
  const version = useStudio((s) => s.version);
  const [at, setAtS] = useState<At>(initialAt);
  const [bahi, setBahi] = useState(false);
  const [rects, setRects] = useState<Record<string, DOMRect> | null>(null);

  const [palette, setPalette] = useState(false);
  const setAt = (a: At) => { setAtS(a); router.replace(`/studio/${id}?at=${a}`, { scroll: false }); window.scrollTo({ top: 0 }); };
  useEffect(() => { const a = sp.get("at") as At | null; if (a && a !== at) setAtS(a); }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps
  // the drummer and other fixed props read the current place from <html data-place>
  useEffect(() => { document.documentElement.dataset.place = at; return () => { delete document.documentElement.dataset.place; }; }, [at]);

  // first paint from IndexedDB, server copy reconciles in the background
  useEffect(() => {
    let alive = true;
    (async () => {
      const local = await idb.getDoc(id);
      const st = useStudio.getState();
      if (local && alive) await st.load(id, migrate(local.doc), local.version, local.base, { visibility: local.visibility, status: local.status, publishedVersion: local.publishedVersion });
      // a brand-new shop has nothing on the server yet: open the blank chit at once
      if (!local && sp.get("new") === "1") { if (alive) await useStudio.getState().load(id, blankDoc(), 0, null); return; }
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

  // global keys: undo / redo, and Ctrl/Cmd+K for the command palette
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); return; }
      const tgt = e.target as HTMLElement;
      if (tgt.closest("input,textarea,[contenteditable=true]")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) useStudio.getState().redo(); else useStudio.getState().undo(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const en = lang === "en";
  // honest save sign: a shop that was never saved does not claim "sent"
  const sign = version === 0 && (sync === "idle" || sync === "sent")
    ? { t: en ? "Not saved yet" : "Abhi save nahi", c: "bg-dusk text-chai" }
    : sync === "sent" || sync === "idle" ? { t: en ? "Saved ✓" : "Bhej diya ✓", c: "bg-tota text-chai" }
    : sync === "sending" ? { t: en ? "Saving" : "Bhej rahe hain", c: "bg-chai text-kohl" }
    : sync === "failed" ? { t: en ? "Retry" : "Phir bhejo", c: "bg-mirchi text-chai" }
    : sync === "conflict" ? { t: en ? "Two versions" : "Do version", c: "bg-genda text-kohl" }
    : { t: en ? "Saved on phone" : "Phone pe rakh liya", c: "bg-haldi text-kohl" };

  if (!doc) {
    return (
      <div className="min-h-svh tent grid place-items-center p-4">
        <div className="w-[min(92vw,420px)] aspect-[9/16] shutter-steel border-4 border-kohl" aria-label="Dukaan khul rahi hai" />
      </div>
    );
  }
  const goBoard = (r: Record<string, DOMRect>) => { setRects(r); setAt("board"); };
  const made = doc.scenes.length > 0;

  return (
    <div className="min-h-svh bg-dusk text-chai">
      <header className="sticky top-0 z-30 bg-kohl border-b-4 border-haldi">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Link href="/" className="font-display text-[22px] text-chai no-underline min-h-[44px] min-w-[44px] flex items-center" aria-label={en ? "Back to the lane" : "Gali mein wapas"}>ढिं</Link>
          <h1 className="m-0 font-display text-[clamp(18px,4.6vw,24px)] truncate flex-1 min-w-0" style={{ viewTransitionName: `title-${id}` }}>{doc.brief.name || (en ? "New shop" : "Nayi dukaan")}</h1>
          <button className={`min-h-[44px] px-2 border-2 border-chai text-[14px] leading-tight font-bold max-w-[42vw] ${sign.c}`} onClick={() => { if (sync === "failed") useStudio.getState().flush(); else setBahi(true); }} aria-label={`${sign.t}. ${en ? "Open the history ledger" : "Bahi kholo"}`}>{sign.t}</button>
        </div>
        <nav className="grid grid-cols-4" aria-label={en ? "Steps" : "Kadam"}>
          {PLACES.map((p, i) => {
            const locked = i > 0 && !made;
            const here = at === p.at;
            return (
              <button key={p.at} aria-current={here ? "step" : undefined} aria-disabled={locked || undefined}
                onClick={() => { if (locked) { toast(en ? "First fill the chit and press Make" : "Pehle parchi bharo aur Banao dabao"); return; } setAt(p.at); }}
                className={`min-h-[52px] min-w-0 px-1 py-1 border-0 border-r-2 last:border-r-0 border-dusk cursor-pointer flex flex-col items-center justify-center leading-tight ${here ? "bg-haldi text-kohl" : locked ? "bg-kohl text-chai/45" : "bg-kohl text-chai"}`}>
                <span className="flex items-baseline gap-1"><span className="step-n">{i + 1}</span><span className="font-bold text-[15px]">{en ? p.en : p.verb}</span></span>
                <span className={`text-[11px] ${here ? "text-kohl/80" : "opacity-70"}`}>{en ? p.placeEn : p.place}</span>
              </button>
            );
          })}
        </nav>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.main key={at} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34 }}>
          {at === "parchi" && <Parchi onMade={goBoard} />}
          {at === "board" && <Board rects={rects} onClearRects={() => setRects(null)} onOpenBooth={() => setAt("booth")} onOpenParchi={() => setAt("parchi")} />}
          {at === "booth" && <Booth onOpenPress={() => setAt("press")} onOpenBahi={() => setBahi(true)} />}
          {at === "press" && <Press id={id} onOpenBooth={() => setAt("booth")} />}
        </motion.main>
      </AnimatePresence>

      {bahi && <Bahi onClose={() => setBahi(false)} />}
      {palette && <Palette onClose={() => setPalette(false)} made={made} go={(a) => setAt(a)} openBahi={() => setBahi(true)} />}
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

type Cmd = { id: string; hi: string; en: string; run: () => void; needsScenes?: boolean };
/** Command palette (Ctrl/Cmd+K): every studio action by name, in Hinglish or English. */
function Palette({ onClose, go, openBahi, made }: { onClose: () => void; go: (a: At) => void; openBahi: () => void; made: boolean }) {
  const { lang, setLang, calm, setCalm, toast } = useShell();
  const commit = useStudio((s) => s.commit);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const styles = STYLE_ORDER.map((st): Cmd => ({ id: "style-" + st, hi: `Rang: ${STYLES[st].label}`, en: `Style: ${STYLES[st].label}`, needsScenes: true, run: () => commit(`Rang badla: ${STYLES[st].label}`, (d) => ({ ...d, style: st })) }));
  const aspects = (["9:16", "1:1", "16:9"] as const).map((a): Cmd => ({ id: "aspect-" + a, hi: `Naap ${a}`, en: `Aspect ${a}`, run: () => commit(`Naap ${a}`, (d) => ({ ...d, aspect: a })) }));
  const all: Cmd[] = [
    { id: "parchi", hi: "1. Likho: parchi kholo", en: "1. Write: open the brief", run: () => go("parchi") },
    { id: "board", hi: "2. Dekho: deewar pe scenes", en: "2. Review: scenes on the wall", needsScenes: true, run: () => go("board") },
    { id: "booth", hi: "3. Sajao: tambu mein edit", en: "3. Edit: open the booth", needsScenes: true, run: () => go("booth") },
    { id: "press", hi: "4. Bhejo: video ya link", en: "4. Send: file or link", needsScenes: true, run: () => go("press") },
    { id: "shuffle", hi: "Phir se phento (naya take)", en: "Shuffle again (new take)", needsScenes: true, run: () => commit("Naya take", (d) => reshuffle(d)) },
    { id: "play", hi: "Chalao / roko", en: "Play / pause", needsScenes: true, run: () => { go("booth"); setTimeout(() => window.dispatchEvent(new Event("dh-play")), 350); } },
    { id: "undo", hi: "Wapas (undo)", en: "Undo", run: () => useStudio.getState().undo() },
    { id: "redo", hi: "Aage (redo)", en: "Redo", run: () => useStudio.getState().redo() },
    { id: "bahi", hi: "Bahi: saari likhawat", en: "History ledger", run: openBahi },
    ...styles, ...aspects,
    { id: "calm", hi: calm ? "Shaant mode band" : "Shaant mode chalu", en: calm ? "Calm mode off" : "Calm mode on", run: () => setCalm(!calm) },
    { id: "lang", hi: "English mein dikhao", en: "Show in Hinglish", run: () => setLang(lang === "en" ? "hi-Latn" : "en") },
    { id: "home", hi: "Gali mein wapas", en: "Back to the lane", run: () => { location.href = "/"; } },
  ];
  const needle = q.trim().toLowerCase();
  const list = all.filter((c) => !needle || c.hi.toLowerCase().includes(needle) || c.en.toLowerCase().includes(needle));
  const pick = (c: Cmd | undefined) => {
    if (!c) return;
    if (c.needsScenes && !made) { toast(lang === "en" ? "First fill the chit and press Make" : "Pehle parchi bharo aur Banao dabao"); return; }
    onClose(); c.run();
  };
  return (
    <div className="fixed inset-0 z-[70] bg-kohl/70 flex items-start justify-center pt-[12vh] px-4" onClick={onClose}>
      <div role="dialog" aria-label={lang === "en" ? "Commands" : "Hukum"} className="w-full max-w-[520px] bg-chai text-kohl border-4 border-kohl hard-lg" onClick={(e) => e.stopPropagation()}>
        <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setHi(0); }} placeholder={lang === "en" ? "Type an action: style, undo, send" : "Kya karna hai? jaise: rang, wapas, bhejo"}
          aria-label={lang === "en" ? "Search actions" : "Hukum dhoondho"} aria-controls="dh-cmds" aria-activedescendant={list[hi] ? "cmd-" + list[hi].id : undefined}
          className="w-full min-h-[52px] px-3 text-[17px] bg-[var(--paper)] border-0 border-b-4 border-kohl outline-none"
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); onClose(); }
            else if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(list.length - 1, h + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); pick(list[hi]); }
          }} />
        <ul id="dh-cmds" role="listbox" className="m-0 p-0 list-none max-h-[50svh] overflow-y-auto">
          {list.map((c, i) => (
            <li key={c.id} id={"cmd-" + c.id} role="option" aria-selected={i === hi}>
              <button className={`w-full min-h-[44px] text-left px-3 border-0 border-b border-kohl/15 cursor-pointer ${i === hi ? "bg-haldi" : "bg-transparent"} ${c.needsScenes && !made ? "opacity-50" : ""}`}
                onMouseEnter={() => setHi(i)} onClick={() => pick(c)}>
                {lang === "en" ? c.en : c.hi}
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-3 py-3">{lang === "en" ? "Nothing matches" : "Aisa kuch nahi mila"}</li>}
        </ul>
        <p className="m-0 px-3 py-2 text-[13px] border-t-2 border-kohl">Ctrl/Cmd + K, ↑ ↓, Enter, Esc</p>
      </div>
    </div>
  );
}

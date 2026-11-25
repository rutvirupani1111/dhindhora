"use client";
import { motion } from "motion/react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Doc, Scene } from "@/packages/renderer/core";
import { SCENE_LABEL } from "@/packages/renderer/core";
import { totalMs } from "@/packages/renderer/frame";
import { rebrief, reshuffle } from "@/lib/client/edit";
import { useStudio } from "@/lib/client/store";
import { DocCanvas } from "../DocCanvas";
import { useShell } from "../Shell";

const FRAME: Record<Scene["type"], string> = {
  shutter: "border-[6px] border-[#D7261E] outline outline-4 outline-[#F2B705]",
  meter: "rounded-full border-[6px] border-kohl overflow-hidden",
  kite: "border-[6px] border-double border-rani rotate-[1.5deg]",
  magazine: "rotate-[-3deg] border-4 border-chai",
  phone: "border-[6px] border-[#1F6B3A] rounded-md",
  ladoo: "border-4 border-dashed border-kohl",
  seal: "rounded-full border-[6px] border-[#8f1d1d] overflow-hidden",
  price: "border-4 border-kohl rounded-r-[40px]",
  countdown: "border-[6px] border-kohl",
  end: "border-[6px] border-[#F2B705]",
};

function sourceLabel(src: string, doc: Doc) {
  if (src === "name") return "Naam";
  if (src === "oneLiner") return "Ek line";
  if (src === "cta") return "Bulawa";
  if (src === "offer") return "Offer";
  if (src.startsWith("points.")) return "Point " + (doc.brief.points.findIndex((p) => "points." + p.id === src) + 1);
  if (src.startsWith("numbers.")) return "Number " + (doc.brief.numbers.findIndex((p) => "numbers." + p.id === src) + 1);
  return src;
}

/** One poster: repaints only when its own lock signature, style or brief pins change. */
const Poster = memo(function Poster({ doc, scene }: { doc: Doc; scene: Scene }) {
  const counter = useRef(0);
  const [, force] = useState(0);
  const one = useMemo<Doc>(() => ({ ...doc, scenes: [scene] }), [scene.lock?.sig, scene.style, scene.variant, doc.style, doc.aspect, doc.brief.colors.join(), doc.brief.logo?.hash]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = Math.min(scene.durMs - 50, scene.type === "magazine" ? scene.durMs - 100 : 1700);
  return (
    <div data-draws={counter.current} data-poster={scene.id}>
      <DocCanvas doc={one} t={t} detail={1} onDraw={() => { counter.current++; (document.querySelector(`[data-poster="${scene.id}"]`) as HTMLElement | null)?.setAttribute("data-draws", String(counter.current)); void force; }} label={SCENE_LABEL[scene.type].hi} />
    </div>
  );
}, (a, b) => a.scene.lock?.sig === b.scene.lock?.sig && a.scene.style === b.scene.style && a.scene.variant === b.scene.variant && a.doc.style === b.doc.style && a.doc.aspect === b.doc.aspect && a.doc.brief.colors.join() === b.doc.brief.colors.join() && a.doc.brief.logo?.hash === b.doc.brief.logo?.hash && a.scene.durMs === b.scene.durMs);

export function Board({ rects, onClearRects, onOpenBooth, onOpenParchi }: { rects: Record<string, DOMRect> | null; onClearRects: () => void; onOpenBooth: () => void; onOpenParchi: () => void }) {
  const doc = useStudio((s) => s.doc)!;
  const commit = useStudio((s) => s.commit);
  const { calm, toast, lang } = useShell();
  const en = lang === "en";
  const [sel, setSel] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<Record<string, DOMRect>>({});
  useEffect(() => {
    if (!rects || !gridRef.current) return;
    const s: Record<string, DOMRect> = {};
    gridRef.current.querySelectorAll<HTMLElement>("[data-slot]").forEach((el) => (s[el.dataset.slot!] = el.getBoundingClientRect()));
    setSlots(s);
    const id = setTimeout(onClearRects, 1600 + 90 * doc.scenes.length);
    return () => clearTimeout(id);
  }, [rects]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!doc.scenes.length) {
    return (
      <div className="rangoli min-h-[70svh] grid place-items-center p-6 text-center">
        <div className="bg-kohl text-chai p-4 border-2 border-chai max-w-[360px]"><p className="m-0 mb-3">{en ? "The wall is empty. Fill the chit and press Make: your scenes appear here as posters." : "Deewar khaali hai. Parchi bharo aur Banao dabao: aapke scene yahan poster ban ke lagenge."}</p><button className="tin-btn" onClick={onOpenParchi}>{en ? "Fill the chit" : "Parchi bharo"}</button></div>
      </div>
    );
  }
  const selScene = doc.scenes.find((s) => s.id === sel);
  const shuffle = () => {
    commit(`Take ${doc.seed + 1}`, (d) => reshuffle(d));
    toast(`Take ${doc.seed + 1}`, { label: "Wapas", run: () => useStudio.getState().undo() });
  };

  return (
    <div className="plaster min-h-[calc(100svh-100px)] pb-40 pt-4 px-3">
      <div className="mx-auto max-w-[1100px]">
        {/* what am I looking at: one plain notice pasted on the wall */}
        <div className="mb-5 bg-chai text-kohl border-2 border-kohl hard px-3 py-2 max-w-[640px]">
          <p className="m-0 font-bold">{en ? `Your video: ${doc.scenes.length} scenes, ${(totalMs(doc) / 1000).toFixed(0)} seconds, playing in this order.` : `Aapki video: ${doc.scenes.length} scene, ${(totalMs(doc) / 1000).toFixed(0)} second, isi kram mein chalenge.`}</p>
          <p className="m-0 text-[15px]">{en ? "Tap a poster to change its words. Want a different mix? Shuffle again." : "Kisi poster pe tap karo: uski line yahin badlo. Kuch alag chahiye? Phir se phento."}</p>
          <div className="flex gap-2 mt-2 flex-wrap items-center">
            <button className="tin-btn" onClick={shuffle}>{en ? "Shuffle again" : "Phir se phento"}</button>
            <span className="mono text-[13px]">take {doc.seed}</span>
          </div>
        </div>
        <div ref={gridRef} className="grid gap-x-4 gap-y-8 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {doc.scenes.map((s, i) => {
            const from = rects?.[s.source[0]] || rects?.[s.source[0] === "cta" ? "cta" : "name"];
            const slot = slots[s.id];
            const init = from && slot && !calm ? { x: from.left - slot.left, y: from.top - slot.top, scale: Math.max(0.2, from.width / slot.width), rotate: 0, opacity: 0.6 } : false;
            return (
              <motion.button key={s.id} layout={!calm} data-slot={s.id} onClick={() => setSel(sel === s.id ? null : s.id)}
                initial={init as any} animate={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: [0, 3, -1.5, 0] }}
                transition={{ type: "spring", stiffness: 460, damping: 32, delay: init ? i * 0.09 : 0, rotate: { duration: 0.9, delay: init ? i * 0.09 + 0.3 : 0 } }}
                className={`relative text-left bg-transparent border-0 p-0 cursor-pointer ${sel === s.id ? "outline outline-4 outline-genda outline-offset-4" : ""}`}
                style={{ transformOrigin: "50% 0%" }} aria-pressed={sel === s.id}
                aria-label={`${i + 1}. ${SCENE_LABEL[s.type].hi}, ${(s.durMs / 1000).toFixed(1)} second, ${s.source.map((x) => sourceLabel(x, doc)).join(", ")}`}>
                <span aria-hidden className="absolute -top-3 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-kohl z-10" />
                <div className={`bg-kohl hard ${FRAME[s.type]}`}><Poster doc={doc} scene={s} /></div>
                <div className="mt-2 bg-chai text-kohl border-2 border-kohl px-2 py-1">
                  <span className="block font-bold text-[15px] leading-tight">{SCENE_LABEL[s.type].hi}</span>
                  <span className="mono text-[13px]">{(s.durMs / 1000).toFixed(1)}s</span>
                  <span className="text-[13px] ml-2 bg-haldi px-1">{sourceLabel(s.source[0], doc)}</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
      {selScene && <SourceDrawer scene={selScene} onClose={() => setSel(null)} />}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-kohl border-t-4 border-haldi">
        <div className="mx-auto max-w-[1100px] flex items-center gap-3 pl-[84px] pr-3 py-2 min-h-[76px]">
          <p className="m-0 flex-1 min-w-0 text-chai text-[15px] leading-tight">{en ? "Next: watch it play and fine-tune." : "Aage: video chala ke dekho, chhote badlaav karo."}</p>
          <button className="tin-btn shrink-0" onClick={onOpenBooth}>{en ? "3. Edit →" : "3. Sajao →"}</button>
        </div>
      </div>
    </div>
  );
}

/** Tapping a poster slides the parchi down with only that poster's source lines, highlighted. */
function SourceDrawer({ scene, onClose }: { scene: Scene; onClose: () => void }) {
  const doc = useStudio((s) => s.doc)!;
  const commit = useStudio((s) => s.commit);
  const b = doc.brief;
  const set = (label: string, fn: (x: typeof b) => typeof b, key: string) => commit(label, (d) => rebrief(d, fn(d.brief)), { coalesce: key });
  const fields = scene.source.slice(0, 6);
  return (
    <motion.div initial={{ y: "-100%" }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 420, damping: 34 }}
      role="dialog" aria-label="Is poster ki lines" className="fixed inset-x-0 top-0 z-40 max-h-[40svh] overflow-y-auto paper-lines border-b-4 border-kohl text-kohl px-4 py-3">
      <div className="mx-auto max-w-[560px]">
        <div className="flex justify-between items-center"><p className="m-0 font-display text-[20px]">{SCENE_LABEL[scene.type].hi} ki lines</p><button className="tin-btn chai" onClick={onClose}>Band</button></div>
        {fields.map((f) => {
          const cls = "w-full min-h-[44px] bg-transparent border-0 border-b-[3px] border-haldi px-1 text-[17px] outline-none";
          if (f === "name") return <label key={f} className="block py-1"><span className="text-[15px] font-bold">Naam</span><input className={cls} value={b.name} maxLength={40} onChange={(e) => set("Naam badla", (x) => ({ ...x, name: e.target.value }), "name")} /></label>;
          if (f === "oneLiner") return <label key={f} className="block py-1"><span className="text-[15px] font-bold">Ek line</span><input className={cls} value={b.oneLiner} maxLength={90} onChange={(e) => set("Ek line badli", (x) => ({ ...x, oneLiner: e.target.value }), "oneLiner")} /></label>;
          if (f === "cta") return <label key={f} className="block py-1"><span className="text-[15px] font-bold">Bulawa</span><input className={cls} value={b.cta.text} maxLength={40} onChange={(e) => set("Bulawa badla", (x) => ({ ...x, cta: { ...x.cta, text: e.target.value } }), "cta")} /></label>;
          if (f.startsWith("points.")) {
            const idx = b.points.findIndex((p) => "points." + p.id === f); const p = b.points[idx]; if (!p) return null;
            return <label key={f} className="block py-1"><span className="text-[15px] font-bold">Point {idx + 1}</span><input className={cls} value={p.text} maxLength={60} onChange={(e) => set(`Point ${idx + 1} badla`, (x) => ({ ...x, points: x.points.map((q) => (q.id === p.id ? { ...q, text: e.target.value } : q)) }), "pt" + p.id)} /></label>;
          }
          if (f.startsWith("numbers.")) {
            const idx = b.numbers.findIndex((p) => "numbers." + p.id === f); const n = b.numbers[idx]; if (!n) return null;
            return <label key={f} className="block py-1"><span className="text-[15px] font-bold">Number {idx + 1}: {n.label}</span><input type="number" className={cls} value={n.value} onChange={(e) => set("Number badla", (x) => ({ ...x, numbers: x.numbers.map((q) => (q.id === n.id ? { ...q, value: Number(e.target.value) || 0 } : q)) }), "nv" + n.id)} /></label>;
          }
          return <p key={f} className="m-0 py-1 text-[15px]">Offer: parchi mein badlo</p>;
        })}
      </div>
    </motion.div>
  );
}

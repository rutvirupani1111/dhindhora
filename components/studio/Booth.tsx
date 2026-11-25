"use client";
import { animate, motion, useMotionValue } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Doc, Scene, SceneType, StyleId } from "@/packages/renderer/core";
import { SCENE_LABEL, STYLE_ORDER, VARIANTS, nanoid } from "@/packages/renderer/core";
import { boxesAt, coverTime, frameAt, sceneIndexAt, starts, totalMs } from "@/packages/renderer/frame";
import { blockSpecs, dims, textFor } from "@/packages/renderer/layout";
import { STYLES } from "@/packages/renderer/styles";
import { translit } from "@/packages/renderer/translit";
import { markEdited, patchScene } from "@/lib/client/edit";
import { loadStyleFonts } from "@/lib/client/fonts";
import { useStudio } from "@/lib/client/store";
import { logoFor } from "../DocCanvas";
import { useShell } from "../Shell";

const fmt = (ms: number) => { const s = Math.max(0, ms) / 1000; return `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(2).padStart(5, "0")}`; };
const snap = (ms: number) => { const r = Math.round(ms / 500) * 500; if (Math.abs(r - ms) <= 120) { (navigator as any).vibrate?.(8); return r; } return Math.round(ms / 100) * 100; };

export function Booth({ onOpenPress, onOpenBahi }: { onOpenPress: () => void; onOpenBahi: () => void }) {
  const doc = useStudio((s) => s.doc)!;
  const commit = useStudio((s) => s.commit);
  const past = useStudio((s) => s.past.length);
  const fut = useStudio((s) => s.future.length);
  const { calm, toast, lang } = useShell();
  const en = lang === "en";
  const total = totalMs(doc);
  // open on the cover frame (the hook's words fully on screen), never on an empty first frame
  const [t, setT] = useState(() => coverTime(doc));
  const tRef = useRef(t);
  const [hint, setHint] = useState(false);
  useEffect(() => { try { setHint(localStorage.getItem("dh.hint.booth") !== "1"); } catch { setHint(true); } }, []);
  const closeHint = () => { setHint(false); try { localStorage.setItem("dh.hint.booth", "1"); } catch { /* storage blocked */ } };
  useEffect(() => { const p = () => setPlaying((x) => !x); window.addEventListener("dh-play", p); return () => window.removeEventListener("dh-play", p); }, []);
  const [playing, setPlaying] = useState(false);
  const [sel, setSel] = useState<string | null>(doc.scenes[0]?.id ?? null);
  const [loop, setLoop] = useState(false);
  const [slow, setSlow] = useState(false);
  const [inspector, setInspector] = useState(false);
  const [library, setLibrary] = useState(false);
  const [edit, setEdit] = useState<{ key: string; sceneId: string; before: string } | null>(null);
  const [translitOn, setTranslitOn] = useState(false);
  const [fontWait, setFontWait] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rotY = useMotionValue(0);
  const fade = useMotionValue(1);
  const detailRef = useRef<0 | 1 | 2>(2);
  const dprCap = useRef(2);
  const frameTimes = useRef<number[]>([]);
  const docRef = useRef(doc); docRef.current = doc;
  const [W, H] = dims(doc.aspect);

  useEffect(() => { tRef.current = Math.min(tRef.current, Math.max(0, total - 1)); }, [total]);
  useEffect(() => { loadStyleFonts(doc.style).then(() => draw()); }, [doc.style]); // eslint-disable-line react-hooks/exhaustive-deps

  const draw = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, dprCap.current);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext("2d")!;
    frameAt(ctx, docRef.current, tRef.current, { width: w, height: h, detail: detailRef.current, assets: { logo: logoFor(docRef.current) } });
    if (edit) {
      const s = docRef.current.scenes.find((x) => x.id === edit.sceneId);
      const b = s?.lock?.blocks[edit.key];
      if (b) { ctx.save(); ctx.setTransform(w / W, 0, 0, h / H, 0, 0); ctx.setLineDash([16, 10]); ctx.strokeStyle = "#F07F13"; ctx.lineWidth = 5; ctx.strokeRect(b.box[0] - 8, b.box[1] - 8, b.box[2] + 16, b.box[3] + 16); ctx.restore(); }
    }
  }, [W, H, edit]);
  useEffect(() => { draw(); }, [doc, draw]);

  // playback loop with the 50 fps governor: quality steps down above 18 ms, back up after 120 frames under 12 ms
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now(), good = 0;
    const tick = (now: number) => {
      const dt = now - last; last = now;
      const ft = frameTimes.current; ft.push(dt); if (ft.length > 30) ft.shift();
      const avg = ft.reduce((a, x) => a + x, 0) / ft.length;
      if (ft.length === 30 && avg > 18) {
        if (detailRef.current > 0) detailRef.current = (detailRef.current - 1) as 0 | 1; else dprCap.current = 1;
        frameTimes.current = []; good = 0;
      } else if (dt < 12 && ++good > 120) { detailRef.current = 2; dprCap.current = 2; good = 0; }
      let nt = tRef.current + dt * (slow ? 0.5 : 1);
      const st = starts(docRef.current); const i = docRef.current.scenes.findIndex((s) => s.id === sel);
      if (loop && i >= 0) { const a = st[i], b = a + docRef.current.scenes[i].durMs; if (nt >= b || nt < a) nt = a; }
      else if (nt >= totalMs(docRef.current)) { nt = 0; }
      tRef.current = nt; setT(nt); draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, loop, slow, sel, draw]);

  const seek = useCallback((ms: number) => { tRef.current = Math.max(0, Math.min(total - 1, ms)); setT(tRef.current); requestAnimationFrame(draw); }, [total, draw]);

  // Rang Badlo: hinge the preview on the far edge, swap the style at 90 degrees, settle back
  const flipTo = useCallback(async (next: StyleId, dir: 1 | -1, scope: "all" | "scene" = "all") => {
    const ready = loadStyleFonts(next);
    const slowFont = setTimeout(() => setFontWait(true), 300);
    await ready; clearTimeout(slowFont); setFontWait(false);
    const apply = () => {
      if (scope === "scene" && sel) commit(`Scene ka look: ${STYLES[next].label}`, (d) => patchScene(d, sel, (s) => markEdited({ ...s, style: next }, "style")));
      else commit(`Rang badla: ${STYLES[next].label}`, (d) => ({ ...d, style: next }));
    };
    if (calm) { await animate(fade, 0, { duration: 0.1 }); apply(); await animate(fade, 1, { duration: 0.1 }); return; }
    await animate(rotY, 90 * dir, { duration: 0.24, ease: [0.65, 0, 0.35, 1] });
    apply(); requestAnimationFrame(draw);
    rotY.set(-90 * dir);
    await animate(rotY, 0, { type: "spring", stiffness: 480, damping: 36 });
  }, [calm, commit, draw, fade, rotY, sel]);
  const cycle = (dir: 1 | -1) => { const i = STYLE_ORDER.indexOf(doc.style); flipTo(STYLE_ORDER[(i + dir + STYLE_ORDER.length) % STYLE_ORDER.length], dir); };

  // preview gestures: swipe = style, tap = paint on the poster, two-finger tap = undo
  const g = useRef<{ x: number; y: number; t: number; pointers: number } | null>(null);
  const onPDown = (e: React.PointerEvent) => {
    if (g.current) { g.current.pointers++; return; }
    g.current = { x: e.clientX, y: e.clientY, t: performance.now(), pointers: 1 };
  };
  const onPUp = (e: React.PointerEvent) => {
    const s = g.current; if (!s) return;
    if (s.pointers > 1) { g.current = null; useStudio.getState().undo(); toast("Wapas"); return; }
    g.current = null;
    const dx = e.clientX - s.x, dy = e.clientY - s.y, v = Math.abs(dx) / Math.max(1, performance.now() - s.t);
    if ((Math.abs(dx) > 48 && Math.abs(dx) > 1.5 * Math.abs(dy)) || (v > 0.4 && Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy))) { cycle(dx < 0 ? 1 : -1); return; }
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      const r = canvasRef.current!.getBoundingClientRect();
      const lx = ((e.clientX - r.left) / r.width) * W, ly = ((e.clientY - r.top) / r.height) * H;
      const hit = boxesAt(doc, tRef.current).find((b) => lx >= b.box[0] - 20 && lx <= b.box[0] + b.box[2] + 20 && ly >= b.box[1] - 20 && ly <= b.box[1] + b.box[3] + 20);
      if (hit) {
        setPlaying(false);
        const sc = doc.scenes[hit.sceneIndex];
        setSel(sc.id);
        setEdit({ key: hit.key, sceneId: sc.id, before: textFor(sc, doc.brief, hit.key) });
      } else setPlaying((p) => !p);
    }
  };

  // keyboard
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select,[contenteditable=true]")) return;
      const fr = 1000 / 30;
      const i = doc.scenes.findIndex((s) => s.id === sel);
      if (e.key === " " || e.key.toLowerCase() === "k") { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key.toLowerCase() === "j") seek(tRef.current - 1000);
      else if (e.key.toLowerCase() === "l") { setPlaying(true); }
      else if (e.key === "ArrowLeft" && e.altKey && i > 0) { e.preventDefault(); move(i, i - 1); }
      else if (e.key === "ArrowRight" && e.altKey && i >= 0 && i < doc.scenes.length - 1) { e.preventDefault(); move(i, i + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); seek(tRef.current - (e.shiftKey ? 1000 : fr)); }
      else if (e.key === "ArrowRight") { e.preventDefault(); seek(tRef.current + (e.shiftKey ? 1000 : fr)); }
      else if (e.key === "[" && sel) trim(sel, "head", 100);
      else if (e.key === "]" && sel) trim(sel, "tail", -100);
      else if (e.key === ",") cycle(-1);
      else if (e.key === ".") cycle(1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const move = (from: number, to: number) => {
    if (from === to) return;
    commit(`Scene ${from + 1} ko ${to + 1} pe rakha`, (d) => {
      const a = d.scenes.slice(); const [m] = a.splice(from, 1); a.splice(to, 0, markEdited(m, "order"));
      return { ...d, scenes: a };
    });
  };
  const trim = (id: string, edge: "head" | "tail", deltaMs: number) => {
    commit(edge === "tail" ? "Poonch kaati" : "Sir kaata", (d) => patchScene(d, id, (s) => {
      if (edge === "tail") return markEdited({ ...s, durMs: Math.max(1000, Math.min(12000, s.durMs + deltaMs)) }, "durMs");
      const inMs = Math.max(0, s.inMs + deltaMs), durMs = Math.max(1000, Math.min(12000, s.durMs - (inMs - s.inMs)));
      return markEdited(markEdited({ ...s, inMs, durMs }, "inMs"), "durMs");
    }), { coalesce: "trim" + id + edge });
  };

  const selScene = doc.scenes.find((s) => s.id === sel);
  const idx = sceneIndexAt(doc, t);
  const over = total - doc.lengthSec * 1000;

  return (
    <div className="tent min-h-[calc(100svh-100px)] pb-[160px]">
      {/* scalloped tent pelmet */}
      <svg aria-hidden viewBox="0 0 200 10" preserveAspectRatio="none" className="block w-full h-4"><path d={"M0 0 H200 V4 " + Array.from({ length: 20 }, (_, i) => `Q${200 - i * 10 - 5} 12 ${200 - (i + 1) * 10} 4`).join(" ") + " Z"} fill="var(--mirchi)" /></svg>
      <div className="mx-auto max-w-[980px] px-3 grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col items-center">
          {hint && (
            <div className="w-full max-w-[560px] mb-3 bg-chai text-kohl border-2 border-kohl hard px-3 py-2" role="note">
              <p className="m-0 font-bold">{en ? "How to edit here" : "Yahan kaise sajayein"}</p>
              <ul className="m-0 mt-1 pl-5 text-[15px] leading-snug">
                <li>{en ? "Play shows the whole video." : "Chalao dabao: poori video dekho."}</li>
                <li>{en ? "Tap any words on the video to retype them." : "Video pe likhe shabd pe tap karo: wahin badlo."}</li>
                <li>{en ? "Swipe left or right on it, or pick a look below, to change the style." : "Video pe daayein-baayein swipe karo, ya neeche look chuno: rang badlega."}</li>
                <li>{en ? "Bottom strip: tap a scene, drag its edge to trim, hold and drag to move it." : "Neeche ki patti: scene pe tap, kinaara kheech ke chhota-bada, der tak daba ke khiskao."}</li>
              </ul>
              <button className="tin-btn chai mt-2" onClick={closeHint}>{en ? "Got it" : "Samajh gaya"}</button>
            </div>
          )}
          <div className="relative w-full flex justify-center" style={{ perspective: 1700 }}>
            {/* projector beam: flat kite-paper trapezoid, no blur */}
            <div aria-hidden className="absolute -top-4 left-1/2 -translate-x-1/2 w-[90%] h-[105%] bg-haldi kite-paper opacity-[.10] [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)]" />
            <motion.div ref={wrapRef} className="relative border-4 border-kohl hard-lg bg-kohl" style={{ rotateY: rotY, opacity: fade, transformOrigin: "50% 50%", width: doc.aspect === "16:9" ? "100%" : doc.aspect === "1:1" ? "min(100%, 520px, calc(100svh - 380px))" : "min(100%, 360px, calc((100svh - 370px) * 9 / 16))", backfaceVisibility: "hidden" }}>
              <canvas ref={canvasRef} className="block w-full touch-pan-y cursor-pointer" style={{ aspectRatio: `${W}/${H}` }}
                onPointerDown={onPDown} onPointerUp={onPUp} onPointerCancel={() => (g.current = null)}
                role="img" aria-label={`Preview, ${SCENE_LABEL[doc.scenes[idx]?.type || "shutter"].hi}. Text pe tap karke likho, daayein baayein swipe se rang badlo.`} />
              {edit && <InlineEditor doc={doc} edit={edit} canvas={canvasRef} translitOn={translitOn} setTranslitOn={setTranslitOn} onDone={() => setEdit(null)} />}
              {fontWait && <span className="absolute top-2 left-2 bg-tin text-kohl border-2 border-kohl px-2 font-bold">load ho raha</span>}
            </motion.div>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap justify-center pl-[64px] sm:pl-0">
            <button className="tin-btn min-w-[84px]" onClick={() => setPlaying((p) => !p)} aria-label={playing ? (en ? "Pause" : "Roko") : (en ? "Play" : "Chalao")}>{playing ? (en ? "Pause" : "Roko") : (en ? "▶ Play" : "▶ Chalao")}</button>
            <span className="mono text-[13px] bg-kohl text-chai px-2 py-1 border-2 border-chai inline-block whitespace-nowrap text-center" aria-live="off">{fmt(t)} <span className="opacity-70">/ {(total / 1000).toFixed(1)}s</span></span>
            <button className="tin-btn mirchi" onClick={onOpenPress}>{en ? "4. Send →" : "4. Bhejo →"}</button>
          </div>
          <StyleRow doc={doc} t={t} playing={playing} onPick={(s, scope) => flipTo(s, STYLE_ORDER.indexOf(s) > STYLE_ORDER.indexOf(doc.style) ? 1 : -1, scope)} />
        </div>
        <aside className="hidden lg:block">
          {selScene && <Inspector scene={selScene} doc={doc} />}
        </aside>
      </div>

      {/* reel strip in the thumb zone */}
      <Strip doc={doc} t={t} sel={sel} setSel={setSel} seek={(ms) => { setPlaying(false); seek(ms); }} move={move} trim={trim}
        past={past} fut={fut} over={over}
        onToolbar={(a) => {
          if (a === "bahi") { onOpenBahi(); return; }
          if (a === "add") { setLibrary(true); return; }
          if (a === "loop") { setLoop((l) => !l); return; }
          if (a === "slow") { setSlow((l) => !l); return; }
          if (!selScene) return;
          const i = doc.scenes.findIndex((s) => s.id === selScene.id);
          if (a === "split") {
            const st = starts(doc)[i]; const cut = Math.round((t - st) / 100) * 100;
            if (cut < 1000 || selScene.durMs - cut < 1000) { toast("Itne chhote tukde nahi ban sakte"); return; }
            commit(`Scene ${i + 1} kaata`, (d) => { const a = d.scenes.slice(); a.splice(i, 1, markEdited({ ...selScene, durMs: cut }, "durMs"), { ...selScene, id: nanoid(8), durMs: selScene.durMs - cut, inMs: selScene.inMs + cut, userAdded: true, edited: ["durMs", "inMs"] }); return { ...d, scenes: a }; });
          } else if (a === "dup") commit(`Scene ${i + 1} ki nakal`, (d) => { const a = d.scenes.slice(); a.splice(i + 1, 0, { ...selScene, id: nanoid(8), userAdded: true }); return { ...d, scenes: a }; });
          else if (a === "del") {
            if (doc.scenes.length <= 1) return;
            commit(`Scene ${i + 1} hataya`, (d) => ({ ...d, scenes: d.scenes.filter((s) => s.id !== selScene.id) }));
            toast(`Scene ${i + 1} hataya`, { label: "Wapas", run: () => useStudio.getState().undo() });
          } else if (a === "loop") setLoop((l) => !l);
          else if (a === "slow") setSlow((l) => !l);
          else if (a === "add") setLibrary(true);
          else if (a === "inspect") setInspector(true);
        }} loop={loop} slow={slow} />

      {inspector && selScene && (
        <div className="fixed inset-0 z-50 bg-kohl/60 lg:hidden" onClick={() => setInspector(false)}>
          <div className="absolute inset-x-0 bottom-0 max-h-[75svh] overflow-y-auto bg-chai text-kohl border-t-4 border-kohl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end p-2"><button className="tin-btn chai" onClick={() => setInspector(false)}>Band</button></div>
            <Inspector scene={selScene} doc={doc} />
          </div>
        </div>
      )}
      {library && <Library doc={doc} onClose={() => setLibrary(false)} onPick={(type) => {
        const i = Math.max(0, doc.scenes.findIndex((s) => s.id === sel));
        const src: Record<SceneType, string[]> = {
          shutter: ["name", "oneLiner"], meter: doc.brief.numbers.slice(0, 1).map((n) => "numbers." + n.id), kite: doc.brief.points.slice(0, 3).map((p) => "points." + p.id),
          magazine: doc.brief.points.map((p) => "points." + p.id), phone: ["oneLiner"], ladoo: doc.brief.numbers.map((n) => "numbers." + n.id), seal: ["name"], price: ["offer"], countdown: ["offer"], end: ["cta", "name"],
        };
        const sc: Scene = { id: nanoid(8), type, variant: 0, durMs: 2000, inMs: 0, speed: 1, source: src[type], text: {}, edited: [], userAdded: true };
        commit(`${SCENE_LABEL[type].hi} joda`, (d) => { const a = d.scenes.slice(); a.splice(i + 1, 0, sc); return { ...d, scenes: a }; });
        setSel(sc.id); setLibrary(false);
      }} />}
    </div>
  );
}

/** Paint on the poster: a transparent contenteditable laid exactly over the drawn text box. */
function InlineEditor({ doc, edit, canvas, translitOn, setTranslitOn, onDone }: {
  doc: Doc; edit: { key: string; sceneId: string; before: string }; canvas: React.RefObject<HTMLCanvasElement | null>;
  translitOn: boolean; setTranslitOn: (b: boolean) => void; onDone: () => void;
}) {
  const commit = useStudio((s) => s.commit);
  const ref = useRef<HTMLDivElement>(null);
  const scene = doc.scenes.find((s) => s.id === edit.sceneId);
  const block = scene?.lock?.blocks[edit.key];
  const [W] = dims(doc.aspect);
  const [roman, setRoman] = useState<Record<string, string>>({});
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.textContent = edit.before; el.focus();
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
    const s = getSelection(); s?.removeAllRanges(); s?.addRange(r);
  }, [edit.sceneId, edit.key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!scene || !block) return null;
  const cw = canvas.current?.getBoundingClientRect().width || 300;
  const k = cw / W;
  const label = `${SCENE_LABEL[scene.type].hi} ${doc.scenes.indexOf(scene) + 1}`;
  const write = (txt: string) => commit(`${label}: '${txt.slice(0, 24)}'`, (d) => patchScene(d, scene.id, (s) => markEdited({ ...s, text: { ...s.text, [edit.key]: txt } }, "text." + edit.key)), { coalesce: "edit" + scene.id + edit.key });
  const onInput = (e: React.FormEvent<HTMLDivElement>) => {
    let txt = e.currentTarget.textContent || "";
    if (translitOn && /\s$/.test(txt)) {
      const r = translit(txt);
      if (r.text !== txt) { setRoman((m) => ({ ...m, ...r.roman })); txt = r.text; e.currentTarget.textContent = txt; const rg = document.createRange(); rg.selectNodeContents(e.currentTarget); rg.collapse(false); const s = getSelection(); s?.removeAllRanges(); s?.addRange(rg); }
    }
    write(txt);
  };
  const emphasize = () => {
    const w = (getSelection()?.toString() || "").trim().split(/\s+/)[0];
    if (!w) return;
    commit(`${label}: zor '${w}'`, (d) => patchScene(d, scene.id, (s) => markEdited({ ...s, text: { ...s.text, em: w } }, "text.em")));
  };
  const revertWord = () => {
    const el = ref.current; if (!el) return;
    let txt = el.textContent || "";
    for (const [d, r] of Object.entries(roman)) txt = txt.split(d).join(r);
    el.textContent = txt; write(txt);
  };
  const [x, y, w, h] = block.box;
  return (
    <>
      <div ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-label={`${label} ka text`} aria-multiline="true"
        onInput={onInput}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); write(edit.before); onDone(); }
          if (e.key === "Enter") { e.preventDefault(); onDone(); }
          e.stopPropagation();
        }}
        onBlur={(e) => { if (!(e.relatedTarget as HTMLElement | null)?.closest("[data-edit-toolbar]")) onDone(); }}
        className="absolute outline-none whitespace-pre-wrap break-words"
        style={{ left: x * k, top: y * k, width: w * k, minHeight: h * k, fontFamily: `'${block.family}','Baloo 2',sans-serif`, fontWeight: block.weight, fontSize: block.px * k, lineHeight: 1.18, color: "transparent", caretColor: "var(--haldi)", textAlign: block.align, display: "flex", flexDirection: "column", justifyContent: "center" }} />
      <div data-edit-toolbar className="absolute left-1/2 -translate-x-1/2 -top-14 flex gap-1 z-10" onMouseDown={(e) => e.preventDefault()}>
        <button className="chip" aria-pressed={translitOn} onClick={() => setTranslitOn(!translitOn)} aria-label="Hinglish se Devanagari">अ/A</button>
        <button className="chip" onClick={emphasize}>Zor</button>
        {Object.keys(roman).length > 0 && <button className="chip" onClick={revertWord}>Roman</button>}
        <button className="chip" onClick={onDone}>Done</button>
      </div>
    </>
  );
}

function StyleRow({ doc, t, playing, onPick }: { doc: Doc; t: number; playing: boolean; onPick: (s: StyleId, scope: "all" | "scene") => void }) {
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);
  const last = useRef(0);
  const [sheet, setSheet] = useState<StyleId | null>(null);
  const lp = useRef<number | undefined>(undefined);
  const [W, H] = dims(doc.aspect);
  useEffect(() => {
    const now = performance.now();
    if (playing && now - last.current < 100) return;
    last.current = now;
    STYLE_ORDER.forEach((s, i) => {
      const c = refs.current[i]; if (!c) return;
      const h = 64 * 2, w = Math.round((h * W) / H);
      if (c.width !== w) { c.width = w; c.height = h; }
      loadStyleFonts(s).then(() => frameAt(c.getContext("2d")!, doc, t, { width: w, height: h, detail: 0, styleOverride: s }));
    });
  }, [doc, t, playing, W, H]);
  return (
    <div className="mt-3 w-full overflow-x-auto no-scrollbar">
      <div className="flex gap-3 justify-center min-w-max px-2 pb-2">
        {STYLE_ORDER.map((s, i) => (
          <button key={s} aria-pressed={doc.style === s} aria-label={`Rang: ${STYLES[s].label}`}
            onClick={() => onPick(s, "all")}
            onPointerDown={() => { lp.current = window.setTimeout(() => setSheet(s), 450); }} onPointerUp={() => clearTimeout(lp.current)} onPointerLeave={() => clearTimeout(lp.current)}
            onContextMenu={(e) => { e.preventDefault(); setSheet(s); }}
            className={`flex flex-col items-center gap-1 bg-transparent border-0 p-0 cursor-pointer ${doc.style === s ? "" : "opacity-80"}`}>
            <canvas ref={(el) => { refs.current[i] = el; }} className={`h-16 border-2 ${doc.style === s ? "border-haldi" : "border-kohl"}`} style={{ aspectRatio: `${W}/${H}` }} />
            <span className={`text-[13px] font-bold px-1 ${doc.style === s ? "bg-haldi text-kohl" : "text-chai"}`}>{STYLES[s].label}</span>
          </button>
        ))}
      </div>
      {sheet && (
        <div className="fixed inset-0 z-50 bg-kohl/60" onClick={() => setSheet(null)}>
          <div className="absolute inset-x-0 bottom-0 bg-chai text-kohl border-t-4 border-kohl p-4 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <p className="m-0 font-display text-[20px]">{STYLES[sheet].label}</p>
            <button className="tin-btn" onClick={() => { onPick(sheet, "all"); setSheet(null); }}>Poori video</button>
            <button className="tin-btn chai" onClick={() => { onPick(sheet, "scene"); setSheet(null); }}>Sirf is scene pe</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Strip({ doc, t, sel, setSel, seek, move, trim, past, fut, over, onToolbar, loop, slow }: {
  doc: Doc; t: number; sel: string | null; setSel: (id: string) => void; seek: (ms: number) => void;
  move: (from: number, to: number) => void; trim: (id: string, e: "head" | "tail", d: number) => void;
  past: number; fut: number; over: number; onToolbar: (a: string) => void; loop: boolean; slow: boolean;
}) {
  const lane = useRef<HTMLDivElement>(null);
  const commit = useStudio((s) => s.commit);
  const total = totalMs(doc);
  const [laneW, setLaneW] = useState(320);
  const [zoom, setZoom] = useState(1);
  useEffect(() => { const el = lane.current; if (!el) return; const ro = new ResizeObserver(() => setLaneW(el.clientWidth)); ro.observe(el); return () => ro.disconnect(); }, []);
  const pps = ((laneW - 8) / Math.max(1, total / 1000)) * zoom;
  const st = starts(doc);
  const [lift, setLift] = useState<{ i: number; dx: number; tilt: number } | null>(null);
  const press = useRef<{ x: number; y: number; i: number; timer?: number; lifted: boolean; lastX: number; lastT: number } | null>(null);
  const scrub = useRef(false);
  const posToMs = (clientX: number) => { const r = lane.current!.getBoundingClientRect(); return (lane.current!.scrollLeft + clientX - r.left) / pps * 1000; };

  const onBgDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-handle]")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const fi = (e.target as HTMLElement).closest<HTMLElement>("[data-frame]");
    if (fi) {
      const i = Number(fi.dataset.frame);
      press.current = { x: e.clientX, y: e.clientY, i, lifted: false, lastX: e.clientX, lastT: performance.now() };
      press.current.timer = window.setTimeout(() => { if (press.current) { press.current.lifted = true; setLift({ i, dx: 0, tilt: 0 }); (navigator as any).vibrate?.(8); } }, 350);
    }
    scrub.current = true; seek(posToMs(e.clientX));
  };
  const onBgMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (p) {
      if (!p.lifted && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) { clearTimeout(p.timer); press.current = null; }
      else if (p.lifted) {
        const v = (e.clientX - p.lastX) / Math.max(1, performance.now() - p.lastT);
        p.lastX = e.clientX; p.lastT = performance.now();
        setLift({ i: p.i, dx: e.clientX - p.x, tilt: Math.max(-6, Math.min(6, v * 20 * 0.02 * 50)) });
        const r = lane.current!.getBoundingClientRect();
        if (e.clientX > r.right - 40) lane.current!.scrollLeft += 10; else if (e.clientX < r.left + 40) lane.current!.scrollLeft -= 10;
        return;
      }
    }
    if (scrub.current) seek(posToMs(e.clientX));
  };
  const onBgUp = (e: React.PointerEvent) => {
    const p = press.current; press.current = null; scrub.current = false;
    if (p) {
      clearTimeout(p.timer);
      if (p.lifted && lift) {
        const center = (st[p.i] + doc.scenes[p.i].durMs / 2) / 1000 * pps + lift.dx;
        let to = 0; for (let k = 0; k < doc.scenes.length; k++) if (center > (st[k] + doc.scenes[k].durMs / 2) / 1000 * pps) to = k;
        if (to !== p.i) move(p.i, to);
        setLift(null); return;
      }
      setSel(doc.scenes[p.i].id);
    }
    void e;
  };
  // edge handles: right trims the tail, left trims the head, Alt + right retimes
  const edge = (id: string, side: "head" | "tail") => (e: React.PointerEvent) => {
    e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const s0 = doc.scenes.find((s) => s.id === id)!; const x0 = e.clientX; const alt = e.altKey;
    const mv = (ev: PointerEvent) => {
      const dms = ((ev.clientX - x0) / pps) * 1000;
      commit(side === "tail" ? (alt ? "Raftaar badli" : "Poonch kaati") : "Sir kaata", (d) => patchScene(d, id, (s) => {
        if (side === "tail" && alt) { const dur = Math.max(1000, Math.min(12000, s0.durMs + dms)); const speed = Math.max(0.5, Math.min(2, (s0.durMs * s0.speed) / dur)); return markEdited(markEdited({ ...s, durMs: Math.round(dur / 100) * 100, speed: Math.round(speed * 100) / 100 }, "speed"), "durMs"); }
        if (side === "tail") return markEdited({ ...s, durMs: Math.max(1000, Math.min(12000, snap(s0.durMs + dms))) }, "durMs");
        const cut = Math.max(-s0.inMs, Math.min(s0.durMs - 1000, Math.round(dms / 100) * 100));
        return markEdited(markEdited({ ...s, inMs: s0.inMs + cut, durMs: s0.durMs - cut }, "inMs"), "durMs");
      }), { coalesce: "edge" + id + side + x0 });
    };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 h-[140px] bg-kohl border-t-4 border-haldi flex flex-col">
      <div className="flex items-center gap-1 px-2 h-[44px] overflow-x-auto no-scrollbar">
        <button className="chip shrink-0" onClick={() => onToolbar("add")}>+ Scene</button>
        <button className="chip shrink-0" disabled={!sel} onClick={() => onToolbar("split")}>Kaato</button>
        <button className="chip shrink-0" disabled={!sel} onClick={() => onToolbar("dup")}>Nakal</button>
        <button className="chip shrink-0" disabled={!sel} onClick={() => onToolbar("del")}>Hatao</button>
        <button className="chip shrink-0" aria-pressed={loop} onClick={() => onToolbar("loop")}>Loop</button>
        <button className="chip shrink-0" aria-pressed={slow} onClick={() => onToolbar("slow")}>0.5x</button>
        <button className="chip shrink-0 lg:hidden" disabled={!sel} onClick={() => onToolbar("inspect")}>Jaanch</button>
        <button className="chip shrink-0" onClick={() => setZoom((z) => (z >= 4 ? 0.5 : z * 2))} aria-label="Zoom">{zoom}x</button>
        <button className="chip shrink-0" onClick={() => onToolbar("bahi")}>Bahi</button>
        <span className={`ml-auto shrink-0 mono text-[13px] px-2 ${over > 0 ? "bg-mirchi text-chai" : "text-chai"}`}>{over > 0 ? `${doc.lengthSec} sec se ${(over / 1000).toFixed(1)} sec zyada` : `${(total / 1000).toFixed(1)}s`}</span>
      </div>
      <div className="flex items-stretch flex-1 min-h-0">
        <button className="w-[44px] shrink-0 bg-dusk text-chai border-0 border-r-2 border-haldi font-bold" disabled={!past} onClick={() => useStudio.getState().undo()} aria-label="Wapas (undo)">↶</button>
        <div ref={lane} className="relative flex-1 overflow-x-auto overflow-y-hidden no-scrollbar touch-pan-x"
          role="slider" aria-label="Samay" aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(t)} aria-valuetext={`${(t / 1000).toFixed(1).replace(/^(\d+)/, (m) => `0:${m.padStart(2, "0")}`)} of 0:${String(Math.round(total / 1000)).padStart(2, "0")}`} tabIndex={0}
          onPointerDown={onBgDown} onPointerMove={onBgMove} onPointerUp={onBgUp} onPointerCancel={onBgUp}
          onWheel={(e) => { if (e.ctrlKey) { setZoom((z) => Math.max(0.5, Math.min(4, z * (e.deltaY < 0 ? 1.25 : 0.8)))); } }}>
          <div className="relative h-full sprockets" style={{ width: Math.max(laneW, (total / 1000) * pps + 8), backgroundPosition: "0 2px", paddingTop: 12, paddingBottom: 12 }}>
            <div role="listbox" aria-label="Scenes" className="relative h-full flex">
              {doc.scenes.map((s, i) => {
                const w = (s.durMs / 1000) * pps;
                const lifted = lift?.i === i;
                const shift = lift && !lifted ? (() => { const c = (st[lift.i] + doc.scenes[lift.i].durMs / 2) / 1000 * pps + lift.dx; const mid = (st[i] + s.durMs / 2) / 1000 * pps; const lw = (doc.scenes[lift.i].durMs / 1000) * pps; if (i > lift.i && c > mid) return -lw; if (i < lift.i && c < mid) return lw; return 0; })() : 0;
                return (
                  <motion.div key={s.id} data-frame={i} role="option" aria-selected={sel === s.id} aria-label={`${i + 1}. ${SCENE_LABEL[s.type].hi}, ${(s.durMs / 1000).toFixed(1)} seconds`}
                    animate={{ x: lifted ? lift!.dx : shift, scale: lifted ? 1.06 : 1, rotate: lifted ? lift!.tilt : 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className={`relative h-full shrink-0 border-2 select-none ${sel === s.id ? "border-haldi z-10" : "border-chai/40"} ${lifted ? "z-20" : ""}`}
                    style={{ width: w, transformOrigin: "50% 0%", background: STYLES[s.style || doc.style].ground }}>
                    <span className="absolute left-2 top-1 right-2 truncate text-[13px] font-bold" style={{ color: STYLES[s.style || doc.style].ink }}>{i + 1}. {SCENE_LABEL[s.type].hi}</span>
                    <span className="absolute left-2 bottom-1 mono text-[11px]" style={{ color: STYLES[s.style || doc.style].ink }}>{(s.durMs / 1000).toFixed(1)}s</span>
                    {sel === s.id && <>
                      <div data-handle onPointerDown={edge(s.id, "head")} className="absolute -left-[19px] top-0 bottom-0 w-[44px] cursor-ew-resize flex justify-center" aria-label="Shuru kaato"><span className="w-[6px] h-full bg-haldi" /></div>
                      <div data-handle onPointerDown={edge(s.id, "tail")} className="absolute -right-[19px] top-0 bottom-0 w-[44px] cursor-ew-resize flex justify-center" aria-label="Aakhir kaato"><span className="w-[6px] h-full bg-haldi" /></div>
                    </>}
                  </motion.div>
                );
              })}
            </div>
            <div aria-hidden className="absolute top-0 bottom-0 w-[3px] bg-rani pointer-events-none" style={{ transform: `translateX(${(t / 1000) * pps}px)` }} />
          </div>
        </div>
        <button className="w-[44px] shrink-0 bg-dusk text-chai border-0 border-l-2 border-haldi font-bold" disabled={!fut} onClick={() => useStudio.getState().redo()} aria-label="Aage (redo)">↷</button>
      </div>
    </div>
  );
}

function Inspector({ scene, doc }: { scene: Scene; doc: Doc }) {
  const commit = useStudio((s) => s.commit);
  const i = doc.scenes.indexOf(scene);
  const keys = blockSpecs(scene, doc.brief, doc.aspect).map((b) => b.key);
  const up = (label: string, fn: (s: Scene) => Scene, co?: string) => commit(label, (d) => patchScene(d, scene.id, fn), co ? { coalesce: co + scene.id } : undefined);
  const nums = scene.source.filter((s) => s.startsWith("numbers."));
  return (
    <div className="bg-chai text-kohl border-4 border-kohl hard p-3 flex flex-col gap-3">
      <p className="m-0 font-display text-[20px]">{i + 1}. {SCENE_LABEL[scene.type].hi}</p>
      <div><p className="m-0 text-[15px] font-bold">Andaaz</p><div className="flex gap-2 flex-wrap">{VARIANTS[scene.type].map((v, k) => <button key={v} className="chip" aria-pressed={scene.variant === k} onClick={() => up(`${SCENE_LABEL[scene.type].hi}: ${v}`, (s) => markEdited({ ...s, variant: k as 0 | 1 | 2 }, "variant"))}>{v}</button>)}</div></div>
      {keys.map((k) => (
        <label key={k} className="block"><span className="text-[15px] font-bold">Text: {k}</span>
          <input className="w-full min-h-[44px] border-2 border-kohl bg-white/60 px-2" value={textFor(scene, doc.brief, k)} maxLength={120}
            onChange={(e) => up(`${SCENE_LABEL[scene.type].hi} ${i + 1}: '${e.target.value.slice(0, 20)}'`, (s) => markEdited({ ...s, text: { ...s.text, [k]: e.target.value } }, "text." + k), "insp" + k)} /></label>
      ))}
      <label className="block"><span className="text-[15px] font-bold">Zor wala shabd</span>
        <input className="w-full min-h-[44px] border-2 border-kohl bg-white/60 px-2" value={scene.text.em || ""} maxLength={24} onChange={(e) => up("Zor badla", (s) => markEdited({ ...s, text: { ...s.text, em: e.target.value } }, "text.em"), "em")} /></label>
      <label className="block"><span className="text-[15px] font-bold">Lambai: <span className="mono">{(scene.durMs / 1000).toFixed(1)}s</span></span>
        <input type="range" min={1000} max={12000} step={100} value={scene.durMs} className="w-full h-[44px] accent-[var(--rani)]" onChange={(e) => up("Lambai badli", (s) => markEdited({ ...s, durMs: Number(e.target.value) }, "durMs"), "dur")} /></label>
      <label className="block"><span className="text-[15px] font-bold">Raftaar: <span className="mono">{scene.speed.toFixed(2)}x</span></span>
        <input type="range" min={0.5} max={2} step={0.05} value={scene.speed} className="w-full h-[44px] accent-[var(--rani)]" onChange={(e) => up("Raftaar badli", (s) => markEdited({ ...s, speed: Number(e.target.value) }, "speed"), "spd")} /></label>
      <label className="block"><span className="text-[15px] font-bold">Is scene ka look</span>
        <select className="w-full min-h-[44px] border-2 border-kohl bg-white/60" value={scene.style || ""} onChange={(e) => up("Scene ka look", (s) => markEdited({ ...s, style: (e.target.value || undefined) as StyleId | undefined }, "style"))}>
          <option value="">Poori video jaisa</option>{STYLE_ORDER.map((s) => <option key={s} value={s}>{STYLES[s].label}</option>)}
        </select></label>
      {nums.length > 0 && <NumberDial doc={doc} refs={nums} />}
    </div>
  );
}

/** Number dial: drag vertically, 1 unit per 4 px, log steps above 1,000. */
function NumberDial({ doc, refs }: { doc: Doc; refs: string[] }) {
  const commit = useStudio((s) => s.commit);
  const items = useMemo(() => refs.map((r) => doc.brief.numbers.find((n) => "numbers." + n.id === r)).filter(Boolean) as Doc["brief"]["numbers"], [refs, doc.brief.numbers]);
  const setVal = (id: string, v: number) => commit("Number badla", (d) => ({ ...d, brief: { ...d.brief, numbers: d.brief.numbers.map((n) => (n.id === id ? { ...n, value: Math.max(0, Math.round(v)) } : n)) } }), { coalesce: "dial" + id });
  return (
    <div className="flex flex-col gap-2">
      {items.map((n) => (
        <div key={n.id} className="flex items-center gap-2">
          <div role="spinbutton" tabIndex={0} aria-label={`${n.label || "Number"} dial`} aria-valuenow={n.value}
            className="w-24 h-[56px] rounded-full bg-kohl text-haldi grid place-items-center font-poster text-[22px] cursor-ns-resize touch-none select-none"
            onKeyDown={(e) => { if (e.key === "ArrowUp") setVal(n.id, n.value + 1); if (e.key === "ArrowDown") setVal(n.id, n.value - 1); }}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              const y0 = e.clientY, v0 = n.value;
              const mv = (ev: PointerEvent) => { const steps = (y0 - ev.clientY) / 4; const v = v0 > 1000 ? v0 * Math.pow(1.01, steps) : v0 + steps; setVal(n.id, v); };
              const upf = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", upf); };
              window.addEventListener("pointermove", mv); window.addEventListener("pointerup", upf);
            }}>{n.prefix}{n.value}{n.suffix}</div>
          <label className="flex items-center gap-1 min-h-[44px]"><input type="checkbox" className="w-5 h-5" checked={n.sample} onChange={(e) => commit("Sample tag", (d) => ({ ...d, brief: { ...d.brief, numbers: d.brief.numbers.map((x) => (x.id === n.id ? { ...x, sample: e.target.checked } : x)) } }))} />sample</label>
        </div>
      ))}
    </div>
  );
}

function Library({ doc, onClose, onPick }: { doc: Doc; onClose: () => void; onPick: (t: SceneType) => void }) {
  const types: SceneType[] = ["shutter", "meter", "kite", "magazine", "phone", "ladoo", "seal", "price", "countdown", "end"];
  return (
    <div className="fixed inset-0 z-50 bg-kohl/60" onClick={onClose}>
      <div role="dialog" aria-label="Scene ki almaari" className="absolute inset-x-0 bottom-0 max-h-[70svh] overflow-y-auto bg-dusk border-t-4 border-haldi p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-2"><p className="m-0 font-display text-[22px] text-chai">Scene chuno</p><button className="tin-btn chai" onClick={onClose}>Band</button></div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {types.map((ty) => <LibTile key={ty} doc={doc} type={ty} onPick={() => onPick(ty)} />)}
        </div>
      </div>
    </div>
  );
}
function LibTile({ doc, type, onPick }: { doc: Doc; type: SceneType; onPick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const sample: Scene = { id: "lib" + type, type, variant: 0, durMs: 2400, inMs: 0, speed: 1, source: type === "kite" || type === "magazine" ? doc.brief.points.map((p) => "points." + p.id) : type === "meter" || type === "ladoo" ? doc.brief.numbers.map((n) => "numbers." + n.id) : type === "end" ? ["cta", "name"] : ["name", "oneLiner"], text: {}, edited: [] };
    const d: Doc = { ...doc, aspect: "1:1", scenes: [sample] };
    let raf = 0, t0 = 0;
    const loop = (now: number) => { if (!t0) t0 = now; frameAt(c.getContext("2d")!, d, (now - t0) % 2400, { width: 192, height: 192, detail: 0 }); raf = requestAnimationFrame(loop); };
    loadStyleFonts(doc.style).then(() => { raf = requestAnimationFrame(loop); });
    return () => cancelAnimationFrame(raf);
  }, [doc, type]);
  return (
    <button onClick={onPick} className="bg-transparent border-0 p-0 cursor-pointer flex flex-col items-center gap-1" aria-label={`${SCENE_LABEL[type].hi} jodo`}>
      <canvas ref={ref} width={192} height={192} className="w-[96px] h-[96px] border-2 border-chai" />
      <span className="text-[13px] font-bold text-chai">{SCENE_LABEL[type].hi}</span>
    </button>
  );
}

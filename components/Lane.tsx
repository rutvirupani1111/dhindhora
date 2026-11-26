"use client";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Doc } from "@/packages/renderer/core";
import { coverTime } from "@/packages/renderer/frame";
import { idb, type Local } from "@/lib/client/idb";
import { newProjectId } from "@/lib/client/newdoc";
import { DocCanvas } from "./DocCanvas";
import { useShell } from "./Shell";

type Row = { id: string; title: string; style: Doc["style"]; aspect: Doc["aspect"]; length_sec: number; status: string; visibility: string; version: number; cover_scene: Doc["scenes"][number] | null; colors: string[] | null; name: string | null; seed: string; deleted_at?: string | null };
export type Demo = { id: string; title: string; doc: Doc; remix_count: number };

const STATUS: Record<string, string> = { draft: "Kaccha", exported: "Status pe", unlisted: "Link wale", public: "Sabke liye" };

function rowDoc(r: Row, local?: Local): Doc {
  if (local) return local.doc;
  return {
    schema: 1, renderer: "1.0.0", seed: Number(r.seed) || 1, style: r.style, aspect: r.aspect, lengthSec: 15,
    brief: { lang: "hinglish", name: r.name || r.title, oneLiner: "", points: [], numbers: [], colors: r.colors || [], cta: { text: "" } },
    scenes: r.cover_scene ? [r.cover_scene] : [],
  };
}

function go(router: ReturnType<typeof useRouter>, href: string) {
  const d = document as any;
  if (d.startViewTransition) d.startViewTransition(() => router.push(href));
  else router.push(href);
}

/** A project shopfront: drag the shutter up 1:1, release past 35% or flick to open. */
function ShopShutter({ row, local, onSheet, closing }: { row: Row; local?: Local; onSheet: (r: Row) => void; closing?: boolean }) {
  const router = useRouter();
  const { calm } = useShell();
  const y = useMotionValue(0);
  const yPct = useTransform(y, (v) => `${v}%`);
  const [peek, setPeek] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; t0: number; last: number; lt: number; moved: boolean; lp?: number } | null>(null);
  const doc = rowDoc(row, local);
  const href = `/studio/${row.id}?at=booth`;
  const finish = useCallback(() => {
    if (calm) { go(router, href); return; }
    animate(y, -100, { type: "spring", stiffness: 460, damping: 34 }).then(() => go(router, href));
  }, [calm, router, href, y]);
  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { y0: e.clientY, t0: performance.now(), last: e.clientY, lt: performance.now(), moved: false };
    drag.current.lp = window.setTimeout(() => { if (drag.current && !drag.current.moved) { drag.current = null; y.set(0); onSheet(row); } }, 450);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dy = e.clientY - d.y0;
    if (Math.abs(dy) > 8) { d.moved = true; clearTimeout(d.lp); setPeek(true); }
    const h = box.current?.offsetHeight || 200;
    y.set(Math.max(-100, Math.min(0, (dy / h) * 100)));
    d.last = e.clientY; d.lt = performance.now();
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null; if (!d) return;
    clearTimeout(d.lp);
    if (!d.moved) { y.set(0); animate(y, -100, { duration: calm ? 0 : 0.7, ease: [0.65, 0, 0.35, 1] }).then(() => go(router, href)); return; }
    const v = (e.clientY - d.last) / Math.max(1, performance.now() - d.lt);
    if (y.get() < -35 || v < -0.5) finish(); else { animate(y, 0, { type: "spring", stiffness: 460, damping: 34 }); setPeek(false); }
  };
  const status = row.visibility !== "private" ? STATUS[row.visibility] : STATUS[row.status];
  return (
    <div className="relative">
      <div ref={box} className="relative aspect-[4/3] border-4 border-kohl hard-lg overflow-hidden bg-kohl select-none touch-none"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); finish(); } }}
        onContextMenu={(e) => { e.preventDefault(); onSheet(row); }}
        role="link" tabIndex={0} aria-label={`${row.title} kholo. ${status}`}>
        <div className="absolute inset-0 grid place-items-center bg-dusk">
          <div className="h-full" style={{ aspectRatio: doc.aspect.replace(":", "/") }}>
            <DocCanvas doc={doc} t={coverTime(doc)} playing={peek && !!local} detail={1} label={`${row.title} ka cover`} />
          </div>
        </div>
        <motion.div className="absolute inset-0 shutter-steel flex flex-col items-center justify-center gap-2 border-b-[10px] border-kohl" style={{ y: yPct }}>
          <h3 className="m-0 font-display text-[clamp(22px,6vw,30px)] text-kohl bg-chai/90 px-3 border-2 border-kohl max-w-[88%] truncate" style={{ viewTransitionName: `title-${row.id}` }}>{row.title}</h3>
          <span className="text-[15px] font-bold bg-kohl text-haldi px-2">{status}</span>
          <span className="absolute bottom-2 right-3 text-[15px] text-kohl font-bold">upar kheecho ya tap karo</span>
        </motion.div>
        {closing && (
          <motion.span aria-hidden className="absolute left-1/2 top-1/2 font-display text-[44px] leading-none text-chai bg-mirchi border-4 border-kohl px-5 py-1 hard"
            initial={calm ? { opacity: 0, x: "-50%", y: "-50%", rotate: -8 } : { scale: 2.2, opacity: 0, x: "-50%", y: "-50%", rotate: -16 }}
            animate={{ scale: 1, opacity: 1, x: "-50%", y: "-50%", rotate: -8 }}
            transition={calm ? { duration: 0.2 } : { duration: 0.18, ease: [0.65, 0, 0.35, 1] }}>BAND</motion.span>
        )}
      </div>
    </div>
  );
}

export function Lane({ demos }: { demos: Demo[] }) {
  const { t, lang, setLang, calm, setCalm, toast } = useShell();
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [closed, setClosed] = useState<Row[]>([]);
  const [locals, setLocals] = useState<Record<string, Local>>({});
  const [sheet, setSheet] = useState<Row | null>(null);
  const [me, setMe] = useState<{ kind: string; name: string | null } | null>(null);
  const [closing, setClosing] = useState<Record<string, boolean>>({});
  const [renaming, setRenaming] = useState<string | null>(null);
  // the drummer and other fixed props read the current place from <html data-place>
  useEffect(() => { document.documentElement.dataset.place = "lane"; return () => { delete document.documentElement.dataset.place; }; }, []);

  const load = useCallback(async () => {
    const [a, b, l, m] = await Promise.all([
      fetch("/api/projects").then((r) => r.json()).catch(() => ({ items: [] })),
      fetch("/api/projects?deleted=1").then((r) => r.json()).catch(() => ({ items: [] })),
      idb.allDocs(),
      fetch("/api/me").then((r) => r.json()).catch(() => null),
    ]);
    setRows(a.items || []); setClosed(b.items || []); setMe(m);
    setLocals(Object.fromEntries((l || []).map((x) => [x.id, x])));
  }, []);
  useEffect(() => { load(); }, [load]);

  const newShop = () => go(router, `/studio/${newProjectId()}?at=parchi&new=1`);
  const del = async (r: Row) => {
    setSheet(null);
    // the shutter slams with a BAND sticker, then the shopfront leaves the lane
    setClosing((c) => ({ ...c, [r.id]: true }));
    const res = await fetch(`/api/projects/${r.id}`, { method: "DELETE" });
    await new Promise((ok) => setTimeout(ok, calm ? 200 : 520));
    setClosing((c) => { const n = { ...c }; delete n[r.id]; return n; });
    if (res.ok) setRows((xs) => (xs || []).filter((x) => x.id !== r.id));
    if (!res.ok) { toast("Band nahi hua, phir try karo"); load(); return; }
    toast(`${r.title}: BAND`, { label: "Wapas", run: async () => { await fetch(`/api/projects/${r.id}/restore`, { method: "POST" }); load(); } });
    load();
  };
  const dup = async (r: Row) => {
    setSheet(null);
    const res = await fetch(`/api/projects/${r.id}/duplicate`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (res.ok) go(router, `/studio/${j.id}?at=parchi`); else toast(j.message || "Nahi hua");
  };
  const rename = async (r: Row, raw: string) => {
    const name = raw.trim().slice(0, 40);
    setSheet(null); setRenaming(null);
    if (!name || name === r.title) return;
    setRows((xs) => (xs || []).map((x) => (x.id === r.id ? { ...x, title: name } : x)));
    const g = await fetch(`/api/projects/${r.id}`).then((x) => x.json());
    // scenes that paint the name drop their layout lock, so the new name is laid out fresh wherever it is drawn
    const scenes = (g.doc.scenes as Doc["scenes"]).map((s) => { if (!s.source.includes("name")) return s; const { lock: _old, ...rest } = s; void _old; return rest; });
    const doc = { ...g.doc, brief: { ...g.doc.brief, name }, scenes };
    const res = await fetch(`/api/projects/${r.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseVersion: g.version, doc }) });
    if (res.ok) { const j = await res.json(); await idb.putDoc({ id: r.id, doc, version: j.version, base: doc, dirty: false, updatedAt: Date.now() }); toast(`Naam badla: ${name}`); }
    else toast("Naam nahi badla, phir try karo");
    load();
  };
  const signOut = async () => {
    const r = await fetch("/api/auth", { method: "DELETE" });
    if (r.ok) { toast(lang === "en" ? "Signed out. Your shops stay in your account." : "Bahar aa gaye. Dukaanein account mein surakshit hain."); load(); }
  };
  const restore = async (r: Row) => { await fetch(`/api/projects/${r.id}/restore`, { method: "POST" }); load(); };

  return (
    <div className="relative min-h-svh overflow-x-clip bg-dusk">
      {/* back depth: flat dusk sky, water tank, two kites */}
      <svg aria-hidden className="px-back pointer-events-none absolute inset-x-0 top-0 h-[70vh] w-full" preserveAspectRatio="xMidYMin slice" viewBox="0 0 400 300">
        <rect width="400" height="300" fill="var(--dusk)" />
        <g transform="translate(300 40)"><rect width="56" height="36" fill="#3c2d42" stroke="#1B1A17" strokeWidth="2" /><path d="M8 36 v60 M48 36 v60 M8 66 h40" stroke="#3c2d42" strokeWidth="4" /></g>
        <g><path d="M60 40 l18 -18 l18 18 l-18 22z" fill="#E0218A" opacity=".82" stroke="#1B1A17" /><path d="M78 62 q-10 60 30 120" stroke="#1B1A17" fill="none" /></g>
        <g><path d="M200 70 l12 -12 l12 12 l-12 15z" fill="#F2B705" opacity=".82" stroke="#1B1A17" /><path d="M212 85 q20 50 -10 120" stroke="#1B1A17" fill="none" /></g>
      </svg>
      {/* middle depth: bunting and wires */}
      <svg aria-hidden className="px-mid pointer-events-none absolute inset-x-0 top-[38vh] h-24 w-full" preserveAspectRatio="none" viewBox="0 0 400 40">
        <path d="M0 6 Q100 30 200 8 T400 10" stroke="#1B1A17" fill="none" strokeWidth="1.2" />
        <path d="M0 16 Q120 36 260 14 T400 20" stroke="#1B1A17" fill="none" strokeWidth="1" />
        {Array.from({ length: 16 }, (_, i) => { const x = 12 + i * 25; const yy = 6 + Math.sin((x / 400) * Math.PI) * 18; return <path key={i} d={`M${x} ${yy} l6 0 l-3 9z`} fill={["#D7261E", "#F2B705", "#3F8F3A", "#E0218A"][i % 4]} stroke="#1B1A17" strokeWidth=".6" />; })}
      </svg>

      <header className="relative z-10 flex items-center justify-between gap-2 px-4 py-3">
        <button className="min-h-[44px] font-display text-[26px] text-chai bg-transparent border-0 cursor-pointer" onClick={() => window.dispatchEvent(new Event("dh-replay-gate"))} aria-label="Dhindhora: shutter phir se dekho">ढिंढोरा</button>
        <div className="flex items-center gap-2">
          <button className="chip" aria-pressed={lang === "en"} onClick={() => setLang(lang === "en" ? "hi-Latn" : "en")} aria-label="Bhasha badlo">{lang === "en" ? "लिपि" : "EN"}</button>
          <button className="chip" aria-pressed={calm} onClick={() => setCalm(!calm)}>{t("calm")}</button>
          {me?.kind === "member" ? (
            <>
              <span className="hidden sm:inline text-chai text-[15px] max-w-[160px] truncate">{me.name}</span>
              <button className="chip" onClick={signOut}>{lang === "en" ? "Sign out" : "Bahar jao"}</button>
            </>
          ) : <Link href="/signin" className="chip inline-flex items-center no-underline">{t("signin")}</Link>}
        </div>
      </header>

      <main className="relative z-10 px-4 pb-40">
        <p className="mx-auto max-w-[1180px] font-display text-chai text-[clamp(28px,7vw,52px)] leading-[1.05] mt-[12vh] mb-4">{t("hero")}</p>

        {/* how it works: three painted tin signs nailed in a row, so nobody has to guess */}
        <section className="mx-auto max-w-[1180px] mb-6" aria-labelledby="how">
          <h2 id="how" className="sr-only">{t("how")}</h2>
          <ol className="m-0 p-0 list-none grid grid-cols-3 gap-2 max-w-[560px]">
            {([["1", "how1", "how1s", "bg-haldi"], ["2", "how2", "how2s", "bg-genda"], ["3", "how3", "how3s", "bg-tota text-chai"]] as const).map(([n, a, b, c], i) => (
              <li key={n} className={`relative border-2 border-kohl hard px-2 pt-1 pb-2 text-kohl ${c}`} style={{ rotate: `${[-1.5, 1, -0.5][i]}deg` }}>
                <span aria-hidden className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-kohl" />
                <span className="block font-poster text-[26px] leading-none mt-1">{n}</span>
                <span className="block font-bold text-[15px] leading-tight">{t(a)}</span>
                <span className="block text-[13px] leading-tight opacity-90">{t(b)}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Naya dhindhora: shutter half up, paan counter peeking out */}
        <section className="mx-auto max-w-[1180px]">
          <button id="naya-shop" onClick={newShop} className="group relative block w-full max-w-[560px] text-left border-4 border-kohl hard-lg bg-[#5a2d1a] cursor-pointer p-0 overflow-hidden" style={{ viewTransitionName: "naya" }} aria-label={`${t("newShop")}: ${t("newBrief")}`}>
            <div className="bg-haldi border-b-4 border-kohl px-4 py-2 font-display text-[clamp(24px,6vw,34px)] text-kohl">{t("newShop")}</div>
            <div className="relative h-[190px]">
              <div className="absolute inset-x-0 top-0 h-[46%] shutter-steel border-b-[8px] border-kohl transition-transform duration-300 group-hover:-translate-y-3" />
              <div className="absolute inset-x-4 bottom-0 h-[42%] plank border-t-4 border-kohl" />
              <div className="absolute left-8 bottom-[38%] w-16 h-10 bg-[#c9a227] border-2 border-kohl rounded-[4px]" aria-hidden />
              <div className="absolute right-6 bottom-[30%] w-[52%] bg-chai border-2 border-kohl px-3 py-2 rotate-[-3deg] hard">
                <span className="block font-bold text-[17px]">{t("newBrief")}</span>
                <span className="block text-[15px]">Naam, ek line, 3 point. Bas.</span>
              </div>
            </div>
          </button>
          <a href="#demos" className="inline-block mt-4 text-chai font-bold underline underline-offset-4 decoration-haldi decoration-2 min-h-[44px] leading-[44px]">{t("seeDemos")} ↓</a>
        </section>

        <section className="mx-auto max-w-[1180px] mt-10" aria-labelledby="yours">
          <h2 id="yours" className="font-display text-chai text-[26px] mb-4">{t("yourShops")}</h2>
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {rows === null && Array.from({ length: 2 }, (_, i) => <div key={i} className="aspect-[4/3] shutter-steel border-4 border-kohl opacity-60" aria-hidden />)}
            {rows?.map((r) => <ShopShutter key={r.id} row={r} local={locals[r.id]} onSheet={(x) => { setRenaming(null); setSheet(x); }} closing={!!closing[r.id]} />)}
          </div>
          {rows && rows.length === 0 && (
            <div className="rangoli border-4 border-kohl p-6 text-chai max-w-[560px]">
              <p className="m-0 mb-3 bg-kohl inline-block px-2">{t("emptyLane")}</p><br />
              <button className="tin-btn" onClick={newShop}>{t("newBrief")}</button>
            </div>
          )}
        </section>

        <section id="demos-wrap" className="mx-auto max-w-[1180px] mt-14 scroll-mt-4" aria-labelledby="demos">
          <h2 id="demos" className="font-display text-chai text-[24px] mb-4 scroll-mt-4">{t("demos")}</h2>
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {demos.map((d) => <DemoShop key={d.id} d={d} />)}
          </div>
        </section>

        {closed.length > 0 && (
          <section className="mx-auto max-w-[1180px] mt-14">
            <h2 className="font-display text-chai text-[22px] mb-3">{t("closed")}</h2>
            <ul className="m-0 p-0 list-none flex flex-wrap gap-3">
              {closed.map((r) => (
                <li key={r.id} className="flex items-center gap-2 bg-chai text-kohl border-2 border-kohl px-3 py-1 hard">
                  <span className="font-bold">{r.title}</span>
                  <button className="tin-btn" onClick={() => restore(r)}>Phir kholo</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mx-auto max-w-[1180px] mt-16 plaster border-4 border-kohl p-5 text-kohl">
          <p className="m-0 font-bold">{t("terms")}</p>
        </footer>
      </main>

      {sheet && (
        <div className="fixed inset-0 z-50 bg-kohl/60" onClick={() => setSheet(null)}>
          <div role="dialog" aria-label={`${sheet.title}: options`} className="absolute inset-x-0 bottom-0 bg-chai text-kohl border-t-4 border-kohl p-4 pb-8 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <p className="m-0 font-display text-[22px]">{sheet.title}</p>
            {renaming === null ? (
              <button className="tin-btn chai" onClick={() => setRenaming(sheet.title)}>Naam badlo</button>
            ) : (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); rename(sheet, renaming); }}>
                <input autoFocus value={renaming} maxLength={40} onChange={(e) => setRenaming(e.target.value)} aria-label="Naya naam"
                  className="flex-1 min-w-0 min-h-[44px] px-2 text-[17px] bg-[var(--paper)] border-2 border-kohl outline-none focus:border-genda" />
                <button type="submit" className="tin-btn">Rakho</button>
              </form>
            )}
            <button className="tin-btn chai" onClick={() => dup(sheet)}>Doosri dukaan ke liye</button>
            <button className="tin-btn mirchi" onClick={() => del(sheet)}>Band karo</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DemoShop({ d }: { d: Demo }) {
  const router = useRouter();
  const { calm, toast, t, lang } = useShell();
  const [open, setOpen] = useState(false);
  const y = useMotionValue(0);
  const yPct = useTransform(y, (v) => `${v}%`);
  const lift = () => { setOpen(true); animate(y, -100, calm ? { duration: 0 } : { duration: 0.7, ease: [0.65, 0, 0.35, 1] }); };
  const remix = async () => {
    const r = await fetch(`/api/v/${d.id}/remix`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) go(router, `/studio/${j.id}?at=parchi&remix=1`); else toast(j.message || "Thoda ruko, phir try karo");
  };
  return (
    <div className="border-4 border-kohl hard-lg bg-dusk">
      <div className="relative aspect-[4/3] overflow-hidden bg-kohl">
        <div className="absolute inset-0 grid place-items-center"><div className="h-full" style={{ aspectRatio: d.doc.aspect.replace(":", "/") }}><DocCanvas doc={d.doc} playing={open && !calm} t={coverTime(d.doc)} label={`${d.title} demo`} /></div></div>
        <motion.button className="absolute inset-0 shutter-steel border-0 border-b-[10px] border-kohl cursor-pointer flex flex-col items-center justify-center gap-2" style={{ y: yPct }} onClick={lift} aria-label={`${d.title}: shutter uthao aur demo chalao`}>
          <span className="font-display text-[clamp(20px,5.5vw,28px)] bg-chai/90 border-2 border-kohl px-3 text-kohl max-w-[90%]">{d.title}</span>
          <span className="bg-haldi text-kohl font-bold px-2 border-2 border-kohl">{t("demoLabel")}</span>
          <span className="absolute bottom-2 right-3 text-[15px] text-kohl font-bold">{lang === "en" ? "tap to play" : "tap karo, chalegi"}</span>
        </motion.button>
      </div>
      <div className="flex gap-3 p-3 bg-chai border-t-4 border-kohl flex-wrap">
        <button className="tin-btn" onClick={remix}>Remix karo</button>
        <a className="tin-btn chai" href={`/v/${d.id}`}>Link pe dekho</a>
        {d.remix_count >= 1 && <span className="self-center text-[15px] font-bold">{d.remix_count} remix</span>}
      </div>
    </div>
  );
}

"use client";
import { useAnimate } from "motion/react";
import { useRef, useState } from "react";
import type { Brief, Doc, NumberItem } from "@/packages/renderer/core";
import { nanoid } from "@/packages/renderer/core";
import { make, rebrief, validateBrief } from "@/lib/client/edit";
import { logoColours, processLogo } from "@/lib/client/logo";
import { useStudio } from "@/lib/client/store";
import { useShell } from "../Shell";

const TIN_LIDS = ["#D7261E", "#F07F13", "#F2B705", "#3F8F3A", "#00707A", "#E0218A", "#1B1A17", "#7A3E9D"];
const PREFIX: NumberItem["prefix"][] = ["", "₹", "Rs", "#"];
const SUFFIX: NumberItem["suffix"][] = ["", "+", "%", "k", "L", "x", " saal", " seats"];
const PLACEHOLDER = "Aapki dukaan ka naam";

function Line({ label, err, children, hl, id }: { label: string; err?: string; children: React.ReactNode; hl?: boolean; id?: string }) {
  return (
    <div data-field={id} className={`py-2 ${hl ? "bg-haldi/40" : ""}`}>
      <label className="block text-[15px] font-bold text-[#4a3f2e] mb-0.5">{label}</label>
      <div className={err ? "border-b-[3px] border-mirchi" : ""}>{children}</div>
      {err && <p className="m-0 text-[15px] text-mirchi font-bold" role="alert">{err}</p>}
    </div>
  );
}
const inputCls = "w-full min-h-[44px] bg-transparent border-0 border-b-2 border-kohl/30 px-1 text-[17px] text-kohl outline-none focus:border-genda";

export function Parchi({ onMade }: { onMade: (rects: Record<string, DOMRect>) => void }) {
  const doc = useStudio((s) => s.doc)!;
  const commit = useStudio((s) => s.commit);
  const { setDrum, beat, calm, toast } = useShell();
  const [scope, animate] = useAnimate();
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const b = doc.brief;
  const { errors, missing } = validateBrief(b);

  const setBrief = (label: string, fn: (b: Brief) => Brief, key: string) => commit(label, (d) => rebrief(d, fn(d.brief)), { coalesce: key });
  const setDoc = (label: string, fn: (d: Doc) => Doc) => commit(label, fn);

  const banao = async () => {
    if (missing || busy) return;
    setBusy(true);
    const rects: Record<string, DOMRect> = {};
    scope.current?.querySelectorAll("[data-field]").forEach((el: Element) => { rects[(el as HTMLElement).dataset.field!] = el.getBoundingClientRect(); });
    const skip = () => { commit("Banaya", (d) => make(d)); setBusy(false); onMade(rects); };
    if (calm) { await animate(scope.current, { opacity: 0 }, { duration: 0.2 }); skip(); return; }
    const onKey = () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onKey); skip(); };
    window.addEventListener("keydown", onKey); window.addEventListener("pointerdown", onKey);
    try {
      await animate("[data-third='3']", { rotateX: -180 }, { duration: 0.22, ease: [0.65, 0, 0.35, 1] });
      await animate("[data-third='1']", { rotateX: 180 }, { duration: 0.22, ease: [0.65, 0, 0.35, 1] });
      setDrum("beat");
      const p = animate(scope.current, { scale: 0.25, x: -window.innerWidth * 0.38, y: window.innerHeight * 0.3, opacity: 0.2 }, { duration: 0.38, ease: [0.65, 0, 0.35, 1] });
      beat(); setTimeout(beat, 120); setTimeout(beat, 240);
      await p;
    } finally {
      window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onKey);
    }
    setDrum("idle");
    skip();
  };

  const onLogo = async (f: File | undefined) => {
    if (!f) return;
    setLogoBusy(true);
    try {
      const { blob, w, h } = await processLogo(f, false);
      const r = await fetch("/api/logos", { method: "PUT", headers: { "Content-Type": "image/webp" }, body: blob });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Logo nahi gaya");
      setBrief("Logo lagaya", (x) => ({ ...x, logo: { hash: j.hash, w, h, tint: false } }), "logo");
    } catch (e) { toast((e as Error).message); }
    setLogoBusy(false);
  };
  const fromLogo = async () => {
    if (!b.logo) { fileRef.current?.click(); return; }
    const img = new Image(); img.src = "/api/logos/" + b.logo.hash; await img.decode().catch(() => null);
    const cs = logoColours(img);
    if (cs.length) setBrief("Logo se rang liye", (x) => ({ ...x, colors: cs }), "colors"); else toast("Logo mein rang nahi mile");
  };

  const pts = b.points;
  return (
    <div className="plank min-h-[calc(100svh-100px)] pb-44 pt-6 px-3">
      <div className="mx-auto max-w-[560px]" style={{ perspective: 1600 }}>
        <div ref={scope} className="relative" style={{ transformStyle: "preserve-3d" }}>
          {/* torn top edge */}
          <svg aria-hidden viewBox="0 0 100 6" preserveAspectRatio="none" className="block w-full h-3"><path d="M0 6 L0 3 L4 1 L8 4 L13 0 L18 3 L24 1 L29 4 L35 0 L41 3 L47 1 L53 4 L58 0 L64 3 L70 1 L76 4 L82 0 L88 3 L94 1 L100 4 L100 6Z" fill="var(--paper)" /></svg>
          <div data-third="1" className="paper-lines px-4 pt-2 border-x-2 border-kohl text-kohl" style={{ transformOrigin: "bottom", backfaceVisibility: "hidden" }}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 font-display text-[28px]">Parchi</h2>
              <button type="button" onClick={() => (b.logo ? fromLogo() : fileRef.current?.click())} className="relative w-[64px] h-[64px] rounded-full bg-mirchi border-2 border-kohl text-chai font-display text-[15px] cursor-pointer overflow-hidden" aria-label={b.logo ? "Logo badlo" : "Logo lagao"}>
                {b.logo ? <img src={`/api/logos/${b.logo.hash}`} alt="" className="w-full h-full object-contain bg-chai" /> : logoBusy ? "..." : "Logo"}
              </button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => onLogo(e.target.files?.[0])} aria-label="Logo file" />
            </div>
            <Line label="Dukaan ka naam" err={errors.name} id="name" hl={b.name === PLACEHOLDER}>
              <input className={inputCls} value={b.name} maxLength={40} placeholder="Sharma Mithai Bhandar" onChange={(e) => setBrief("Naam badla", (x) => ({ ...x, name: e.target.value }), "name")} onFocus={(e) => { if (b.name === PLACEHOLDER) e.currentTarget.select(); }} />
            </Line>
            <Line label="Ek line mein" err={errors.oneLiner} id="oneLiner">
              <input className={inputCls} value={b.oneLiner} maxLength={90} placeholder="Diwali offer, 20% off, Sunday tak" onChange={(e) => setBrief("Ek line badli", (x) => ({ ...x, oneLiner: e.target.value }), "oneLiner")} />
            </Line>
            {pts.map((p, i) => (
              <Line key={p.id} label={`Point ${i + 1}`} err={errors["points." + p.id]} id={"points." + p.id}>
                <div className="flex items-center gap-1">
                  <span className="w-[44px] h-[44px] grid place-items-center text-kohl/60 cursor-grab select-none" aria-hidden>⋮⋮</span>
                  <input className={inputCls} value={p.text} maxLength={60} placeholder={["Ghar jaisa swaad", "Roz taaza", "Free home delivery"][i] || "Aur ek baat"} onChange={(e) => setBrief(`Point ${i + 1} badla`, (x) => ({ ...x, points: x.points.map((q) => (q.id === p.id ? { ...q, text: e.target.value } : q)) }), "pt" + p.id)} />
                  <button type="button" className="chip" disabled={i === 0} onClick={() => setBrief(`Point ${i + 1} upar`, (x) => { const a = x.points.slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; return { ...x, points: a }; }, "mv")} aria-label={`Point ${i + 1} upar karo`}>↑</button>
                  {pts.length > 3 && <button type="button" className="chip" onClick={() => setBrief("Point hataya", (x) => ({ ...x, points: x.points.filter((q) => q.id !== p.id) }), "rm")} aria-label={`Point ${i + 1} hatao`}>×</button>}
                </div>
              </Line>
            ))}
            {pts.length < 6 && <button type="button" className="chip my-2" onClick={() => setBrief("Point joda", (x) => ({ ...x, points: [...x.points, { id: "p" + nanoid(5), text: "" }] }), "add")}>+ Point</button>}
          </div>
          <div data-third="2" className="paper-lines px-4 border-x-2 border-kohl text-kohl">
            <div className="py-2">
              <p className="m-0 text-[15px] font-bold text-[#4a3f2e]">Number (0 se 4): sirf asli number, director kuch nahi gadhta</p>
              {b.numbers.map((n, i) => (
                <div key={n.id} data-field={"numbers." + n.id} className="flex flex-wrap items-center gap-1 py-1 border-b border-kohl/10">
                  <select className="chip" value={n.prefix} aria-label="Aage" onChange={(e) => setBrief("Number badla", (x) => ({ ...x, numbers: x.numbers.map((q) => (q.id === n.id ? { ...q, prefix: e.target.value as NumberItem["prefix"] } : q)) }), "np" + n.id)}>{PREFIX.map((p) => <option key={p} value={p}>{p || "aage"}</option>)}</select>
                  <input type="number" inputMode="decimal" className={inputCls + " !w-24"} value={n.value} aria-label={`Number ${i + 1}`} onChange={(e) => setBrief("Number badla", (x) => ({ ...x, numbers: x.numbers.map((q) => (q.id === n.id ? { ...q, value: Number(e.target.value) || 0 } : q)) }), "nv" + n.id)} />
                  <select className="chip" value={n.suffix} aria-label="Peeche" onChange={(e) => setBrief("Number badla", (x) => ({ ...x, numbers: x.numbers.map((q) => (q.id === n.id ? { ...q, suffix: e.target.value as NumberItem["suffix"] } : q)) }), "ns" + n.id)}>{SUFFIX.map((p) => <option key={p} value={p}>{p.trim() || "peeche"}</option>)}</select>
                  <input className={inputCls + " !w-36 flex-1"} value={n.label} maxLength={24} placeholder="Batch, saal, seats" aria-label={`Number ${i + 1} ka naam`} onChange={(e) => setBrief("Number ka naam", (x) => ({ ...x, numbers: x.numbers.map((q) => (q.id === n.id ? { ...q, label: e.target.value } : q)) }), "nl" + n.id)} />
                  <label className="flex items-center gap-1 min-h-[44px] text-[15px]"><input type="checkbox" className="w-5 h-5" checked={n.sample} onChange={(e) => setBrief("Sample tag", (x) => ({ ...x, numbers: x.numbers.map((q) => (q.id === n.id ? { ...q, sample: e.target.checked } : q)) }), "nk" + n.id)} />sample</label>
                  <button type="button" className="chip" onClick={() => setBrief("Number hataya", (x) => ({ ...x, numbers: x.numbers.filter((q) => q.id !== n.id) }), "nr")} aria-label="Number hatao">×</button>
                </div>
              ))}
              {b.numbers.length < 4 && <button type="button" className="chip mt-2" onClick={() => setBrief("Number joda", (x) => ({ ...x, numbers: [...x.numbers, { id: "n" + nanoid(5), value: 10, prefix: "", suffix: "+", label: "", sample: false }] }), "nadd")}>+ Number</button>}
            </div>
            <Line label="Offer (agar hai): purana daam, naya daam, kab tak" id="offer">
              <div className="flex flex-wrap gap-2">
                <input type="number" className={inputCls + " !w-28"} placeholder="₹240" aria-label="Purana daam" value={b.offer?.oldPrice ?? ""} onChange={(e) => setBrief("Purana daam", (x) => ({ ...x, offer: { ...x.offer, oldPrice: e.target.value === "" ? undefined : Number(e.target.value) } }), "op")} />
                <input type="number" className={inputCls + " !w-28"} placeholder="₹199" aria-label="Naya daam" value={b.offer?.newPrice ?? ""} onChange={(e) => setBrief("Naya daam", (x) => ({ ...x, offer: { ...x.offer, newPrice: e.target.value === "" ? undefined : Number(e.target.value) } }), "np")} />
                <input type="date" className={inputCls + " !w-44"} aria-label="Offer kab tak" value={b.offer?.endsOn ?? ""} onChange={(e) => setBrief("Offer ki tareekh", (x) => ({ ...x, offer: { ...x.offer, endsOn: e.target.value || undefined } }), "oe")} />
              </div>
            </Line>
          </div>
          <div data-third="3" className="paper-lines px-4 pb-4 border-x-2 border-b-2 border-kohl text-kohl" style={{ transformOrigin: "top", backfaceVisibility: "hidden" }}>
            <Line label="Rang (tin ke dhakkan)" err={errors["colors.0"] || errors["colors.1"] || errors["colors.2"]} id="colors">
              <div className="flex flex-wrap gap-2 items-center">
                {TIN_LIDS.map((c) => {
                  const on = b.colors.includes(c);
                  return <button key={c} type="button" aria-pressed={on} aria-label={`Rang ${c}`} onClick={() => setBrief("Rang badla", (x) => ({ ...x, colors: on ? x.colors.filter((y) => y !== c) : [...x.colors, c].slice(-3) }), "col")}
                    className="w-[44px] h-[44px] rounded-full border-2 border-kohl cursor-pointer" style={{ background: c, boxShadow: on ? "0 0 0 3px var(--paper), 0 0 0 6px var(--kohl)" : "2px 2px 0 var(--kohl)" }} />;
                })}
                <input className={inputCls + " !w-28 mono"} aria-label="Pehla rang hex" defaultValue={b.colors[0] || ""} placeholder="#D7261E" onBlur={(e) => setBrief("Hex rang", (x) => ({ ...x, colors: [e.target.value.trim(), ...x.colors.slice(1)].filter(Boolean) }), "hex")} />
                <button type="button" className="chip" onClick={fromLogo}>Logo se lo</button>
              </div>
            </Line>
            <Line label="Bulawa (CTA)" err={errors.cta} id="cta">
              <input className={inputCls} value={b.cta.text} maxLength={40} onChange={(e) => setBrief("Bulawa badla", (x) => ({ ...x, cta: { ...x.cta, text: e.target.value } }), "cta")} />
            </Line>
            <Line label="Phone" err={errors.phone} id="phone">
              <input className={inputCls} type="tel" inputMode="tel" value={b.cta.phone || ""} placeholder="+91 98xxx xxxxx" onChange={(e) => setBrief("Phone badla", (x) => ({ ...x, cta: { ...x.cta, phone: e.target.value } }), "ph")} />
            </Line>
            <Line label="Pata" id="address">
              <input className={inputCls} value={b.cta.address || ""} maxLength={120} placeholder="Gali no. 4, Station Road" onChange={(e) => setBrief("Pata badla", (x) => ({ ...x, cta: { ...x.cta, address: e.target.value } }), "ad")} />
            </Line>
            <Line label="Link (QR banega)" err={errors.url} id="url">
              <input className={inputCls} type="url" value={b.cta.url || ""} maxLength={120} placeholder="https://" onChange={(e) => setBrief("Link badla", (x) => ({ ...x, cta: { ...x.cta, url: e.target.value } }), "url")} />
            </Line>
            <div className="py-2">
              <p className="m-0 text-[15px] font-bold text-[#4a3f2e]">Naap</p>
              <div className="flex gap-3 items-end">
                {(["9:16", "1:1", "16:9"] as const).map((a) => (
                  <button key={a} type="button" aria-pressed={doc.aspect === a} onClick={() => setDoc(`Naap ${a}`, (d) => ({ ...d, aspect: a }))}
                    className={`border-2 border-kohl grid place-items-center text-[15px] font-bold cursor-pointer ${doc.aspect === a ? "bg-kohl text-haldi" : "bg-chai text-kohl"}`}
                    style={{ width: a === "16:9" ? 78 : a === "1:1" ? 54 : 44, height: a === "9:16" ? 78 : a === "1:1" ? 54 : 44 }}>{a}</button>
                ))}
              </div>
            </div>
            <div className="py-2">
              <p className="m-0 text-[15px] font-bold text-[#4a3f2e]">Lambai</p>
              <div className="flex flex-wrap gap-2">
                {([10, 15, 30, 45, 60] as const).map((l) => <button key={l} type="button" className="chip mono" aria-pressed={doc.lengthSec === l} onClick={() => setDoc(`${l} sec`, (d) => rebrief({ ...d, lengthSec: l }, d.brief))}>{l}s</button>)}
              </div>
            </div>
          </div>
        </div>
        <div className="sticky bottom-[150px] md:bottom-4 mt-4 flex flex-col items-end gap-1 z-10">
          {missing && <p className="m-0 bg-kohl text-chai px-2 py-1 text-[15px] font-bold" role="status">{missing}</p>}
          <button type="button" onClick={banao} disabled={!!missing || busy} className="tin-btn mirchi text-[22px] font-display px-8 rotate-[-4deg]" aria-describedby={missing ? undefined : undefined}>
            {doc.scenes.length ? "Phir banao" : "Banao"}
          </button>
        </div>
      </div>
    </div>
  );
}

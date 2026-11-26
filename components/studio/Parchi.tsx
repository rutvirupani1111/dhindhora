"use client";
import { Reorder, useAnimate, useDragControls } from "motion/react";
import { useEffect, useRef, useState } from "react";
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

/** A worked example, so a first-timer can see the whole thing move before typing a word. */
const EXAMPLE = (b: Brief): Brief => ({
  ...b,
  name: "Gupta Mithai Bhandar",
  oneLiner: "Diwali offer: 20% off, Sunday tak",
  points: [
    { id: "p1", text: "Desi ghee ke ladoo" },
    { id: "p2", text: "Roz subah taaza" },
    { id: "p3", text: "Ghar tak free delivery" },
  ],
  colors: ["#D7261E", "#F2B705"],
  cta: { ...b.cta, text: "Aaj hi aaiye", address: b.cta.address || "Station Road, Gali no. 4" },
  offer: { oldPrice: 480, newPrice: 384 },
});

function Line({ label, err, children, hl, id, ok, hint }: { label: string; err?: string; children: React.ReactNode; hl?: boolean; id?: string; ok?: boolean; hint?: string }) {
  return (
    <div data-field={id} className={`py-2 ${hl ? "bg-haldi/40" : ""}`}>
      <label className="flex items-center gap-2 text-[15px] font-bold text-[#4a3f2e] mb-0.5">
        {ok !== undefined && (
          <span aria-hidden className={`inline-grid place-items-center w-5 h-5 rounded-full border-2 border-kohl text-[12px] leading-none ${ok ? "bg-tota text-chai" : "bg-transparent text-transparent"}`}>✓</span>
        )}
        {label}
      </label>
      {hint && <p className="m-0 text-[13px] text-[#5d5240]">{hint}</p>}
      <div className={err ? "border-b-[3px] border-mirchi" : ""}>{children}</div>
      {err && <p className="m-0 text-[15px] text-mirchi font-bold" role="alert">{err}</p>}
    </div>
  );
}
/** One point line that can be lifted by its grip and dropped elsewhere; the grip also moves it with the arrow keys. */
function PointRow({ p, children }: { p: { id: string; text: string }; children: (grip: (e: React.PointerEvent) => void) => React.ReactNode }) {
  const controls = useDragControls();
  return (
    <Reorder.Item as="div" value={p} dragListener={false} dragControls={controls} className="relative bg-[var(--paper)]"
      whileDrag={{ scale: 1.02, rotate: -0.6 }} transition={{ type: "spring", stiffness: 460, damping: 34 }}>
      {children((e) => controls.start(e))}
    </Reorder.Item>
  );
}
const Grip = () => (
  <svg aria-hidden viewBox="0 0 12 18" width="12" height="18"><g fill="currentColor">{[3, 9, 15].map((y) => <g key={y}><circle cx="3" cy={y} r="1.8" /><circle cx="9" cy={y} r="1.8" /></g>)}</g></svg>
);
const inputCls = "w-full min-h-[44px] bg-transparent border-0 border-b-2 border-kohl/30 px-1 text-[17px] text-kohl outline-none focus:border-genda";

export function Parchi({ onMade }: { onMade: (rects: Record<string, DOMRect>) => void }) {
  const doc = useStudio((s) => s.doc)!;
  const commit = useStudio((s) => s.commit);
  const { setDrum, beat, calm, toast, lang } = useShell();
  const en = lang === "en";
  const [scope, animate] = useAnimate();
  const [busy, setBusy] = useState(false);
  const [folding, setFolding] = useState<false | { done: () => void }>(false);
  const [logoBusy, setLogoBusy] = useState(false);
  // errors show only for lines the person has left, or after they press Banao: never on an empty chit
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [tried, setTried] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const b = doc.brief;
  const { errors: allErrors, missing } = validateBrief(b);
  const errors = Object.fromEntries(Object.entries(allErrors).filter(([k]) => tried || touched[k] || touched[k.split(".")[0]])) as Record<string, string>;
  const touch = (k: string) => () => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  const setBrief = (label: string, fn: (b: Brief) => Brief, key: string) => commit(label, (d) => rebrief(d, fn(d.brief)), { coalesce: key });
  const setDoc = (label: string, fn: (d: Doc) => Doc) => commit(label, fn);

  const pts = b.points;
  const filledPts = pts.filter((p) => p.text.trim()).length;
  const need = [
    { k: "name", ok: !!b.name.trim() },
    { k: "oneLiner", ok: !!b.oneLiner.trim() },
    { k: "points", ok: filledPts >= 3 },
    { k: "cta", ok: !!b.cta.text.trim() },
  ];
  const done = need.filter((n) => n.ok).length;
  const fresh = !b.name.trim() && !b.oneLiner.trim() && filledPts === 0;

  const banao = async () => {
    if (busy) return;
    if (missing) {
      setTried(true);
      const first = need.find((n) => !n.ok)?.k || Object.keys(allErrors)[0]?.split(".")[0];
      const el = first ? scope.current?.querySelector(`[data-field^="${first}"] input`) as HTMLInputElement | null : null;
      el?.focus(); el?.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
      return;
    }
    setBusy(true);
    const rects: Record<string, DOMRect> = {};
    scope.current?.querySelectorAll("[data-field]").forEach((el: Element) => { rects[(el as HTMLElement).dataset.field!] = el.getBoundingClientRect(); });
    let finished = false;
    const skip = () => { if (finished) return; finished = true; setFolding(false); setDrum("idle"); commit("Banaya", (d) => make(d)); setBusy(false); onMade(rects); };
    if (calm) { await animate(scope.current, { opacity: 0 }, { duration: 0.2 }); skip(); return; }
    // the long form steps back and a chit the size of a real parchi takes its place, so the fold and the
    // drop into the dhol happen where the eye already is, whatever the person had scrolled to
    animate(scope.current, { opacity: 0 }, { duration: 0.12 });
    setFolding({ done: skip });
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

  const sectionHead = "m-0 mt-3 mb-1 flex items-baseline gap-2 font-display text-[20px] text-kohl";
  return (
    <div className="plank min-h-[calc(100svh-100px)] pb-40 pt-5 px-3">
      <div className="mx-auto max-w-[560px]" style={{ perspective: 1600 }}>
        <div ref={scope} className="relative" style={{ transformStyle: "preserve-3d" }}>
          {/* torn top edge */}
          <svg aria-hidden viewBox="0 0 100 6" preserveAspectRatio="none" className="block w-full h-3"><path d="M0 6 L0 3 L4 1 L8 4 L13 0 L18 3 L24 1 L29 4 L35 0 L41 3 L47 1 L53 4 L58 0 L64 3 L70 1 L76 4 L82 0 L88 3 L94 1 L100 4 L100 6Z" fill="var(--paper)" /></svg>
          <div data-third="1" className="paper-lines px-4 pt-2 border-x-2 border-kohl text-kohl" style={{ transformOrigin: "bottom", backfaceVisibility: "hidden" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="m-0 font-display text-[28px] leading-tight">Parchi</h2>
                <p className="m-0 text-[15px] text-[#4a3f2e]">{en ? "Fill the 4 must-haves, then press Make. Everything else is optional." : "Pehle 4 zaroori cheezein bharo, phir Banao dabao. Baaki sab chaho toh."}</p>
              </div>
              <button type="button" onClick={() => (b.logo ? fromLogo() : fileRef.current?.click())} className="relative shrink-0 w-[64px] h-[64px] rounded-full bg-mirchi border-2 border-kohl text-chai font-display text-[15px] cursor-pointer overflow-hidden" aria-label={b.logo ? (en ? "Change logo" : "Logo badlo") : (en ? "Add logo (optional)" : "Logo lagao (optional)")}>
                {b.logo ? <img src={`/api/logos/${b.logo.hash}`} alt="" className="w-full h-full object-contain bg-chai" /> : logoBusy ? "..." : "Logo"}
              </button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => onLogo(e.target.files?.[0])} aria-label="Logo file" />
            </div>
            {fresh && (
              <div className="mt-3 flex items-center gap-3 flex-wrap bg-chai border-2 border-dashed border-kohl px-3 py-2">
                <span className="text-[15px] flex-1 min-w-[160px]">{en ? "Not sure what to write? Start from an example and change it." : "Samajh nahi aa raha kya likhein? Ek misaal se shuru karo, phir badal lo."}</span>
                <button type="button" className="tin-btn chai" onClick={() => { commit(en ? "Example filled" : "Misaal bhari", (d) => rebrief(d, EXAMPLE(d.brief))); setTouched({}); }}>{en ? "Fill an example" : "Misaal se bharo"}</button>
              </div>
            )}

            <p className={sectionHead}><span className="font-poster text-mirchi">{done}/4</span>{en ? "Must-haves" : "Zaroori"}</p>
            <Line label={en ? "Shop name" : "Dukaan ka naam"} err={errors.name} id="name" hl={b.name === PLACEHOLDER} ok={need[0].ok}>
              <input className={inputCls} value={b.name} maxLength={40} placeholder="Sharma Mithai Bhandar" onBlur={touch("name")} onChange={(e) => setBrief("Naam badla", (x) => ({ ...x, name: e.target.value }), "name")} onFocus={(e) => { if (b.name === PLACEHOLDER) e.currentTarget.select(); }} />
            </Line>
            <Line label={en ? "In one line: what is the news?" : "Ek line mein: khabar kya hai?"} err={errors.oneLiner} id="oneLiner" ok={need[1].ok}>
              <input className={inputCls} value={b.oneLiner} maxLength={90} placeholder="Diwali offer, 20% off, Sunday tak" onBlur={touch("oneLiner")} onChange={(e) => setBrief("Ek line badli", (x) => ({ ...x, oneLiner: e.target.value }), "oneLiner")} />
            </Line>
            <div data-field="points" className="pt-2">
              <p className="m-0 flex items-center gap-2 text-[15px] font-bold text-[#4a3f2e]">
                <span aria-hidden className={`inline-grid place-items-center w-5 h-5 rounded-full border-2 border-kohl text-[12px] leading-none ${need[2].ok ? "bg-tota text-chai" : "bg-transparent text-transparent"}`}>✓</span>
                {en ? `3 good things about your shop (${filledPts}/3)` : `Dukaan ki 3 achhi baatein (${Math.min(filledPts, 3)}/3)`}
              </p>
            </div>
            <Reorder.Group as="div" axis="y" values={pts} onReorder={(next) => setBrief(en ? "Points reordered" : "Baaton ka kram badla", (x) => ({ ...x, points: next.map((n) => x.points.find((q) => q.id === n.id) || n) }), "reorder")}>
            {pts.map((p, i) => (
              <PointRow key={p.id} p={p}>{(grip) => (
              <Line label={`${en ? "Point" : "Baat"} ${i + 1}${i >= 3 ? (en ? " (optional)" : " (chaho toh)") : ""}`} err={errors["points." + p.id]} id={"points." + p.id}>
                <div className="flex items-center gap-1">
                  <button type="button" className="chip touch-none cursor-grab shrink-0 grid place-items-center !px-0 w-[44px]" onPointerDown={grip}
                    onKeyDown={(e) => {
                      const to = e.key === "ArrowUp" ? i - 1 : e.key === "ArrowDown" ? i + 1 : -1;
                      if (to < 0 || to >= pts.length) return;
                      e.preventDefault();
                      setBrief(`Point ${i + 1} ${to < i ? "upar" : "neeche"}`, (x) => { const a = x.points.slice(); const [m] = a.splice(i, 1); a.splice(to, 0, m); return { ...x, points: a }; }, "mv");
                    }}
                    aria-label={`${en ? "Drag to reorder point" : "Kheech ke kram badlo, baat"} ${i + 1}. ${en ? "Arrow keys move it too." : "Teer wali keys se bhi."}`}><Grip /></button>
                  <input className={inputCls} value={p.text} maxLength={60} placeholder={["Ghar jaisa swaad", "Roz taaza", "Free home delivery"][i] || (en ? "One more thing" : "Aur ek baat")} onBlur={touch("points." + p.id)} onChange={(e) => setBrief(`Point ${i + 1} badla`, (x) => ({ ...x, points: x.points.map((q) => (q.id === p.id ? { ...q, text: e.target.value } : q)) }), "pt" + p.id)} />
                  {pts.length > 3 && <button type="button" className="chip shrink-0" onClick={() => setBrief("Point hataya", (x) => ({ ...x, points: x.points.filter((q) => q.id !== p.id) }), "rm")} aria-label={`${en ? "Remove point" : "Point"} ${i + 1} ${en ? "" : "hatao"}`}>×</button>}
                </div>
              </Line>
              )}</PointRow>
            ))}
            </Reorder.Group>
            {pts.length < 6 && <button type="button" className="chip my-2" onClick={() => setBrief("Point joda", (x) => ({ ...x, points: [...x.points, { id: "p" + nanoid(5), text: "" }] }), "add")}>+ {en ? "Point (up to 6)" : "Baat (6 tak)"}</button>}
            <Line label={en ? "Call to action, said on the last board" : "Bulawa: aakhri board pe kya likhein"} err={errors.cta} id="cta" ok={need[3].ok}>
              <input className={inputCls} value={b.cta.text} maxLength={40} placeholder="Aaj hi aaiye" onBlur={touch("cta")} onChange={(e) => setBrief("Bulawa badla", (x) => ({ ...x, cta: { ...x.cta, text: e.target.value } }), "cta")} />
            </Line>
          </div>
          <div data-third="2" className="paper-lines px-4 border-x-2 border-kohl text-kohl">
            <p className={sectionHead + " border-t-2 border-dashed border-kohl/40 pt-3"}>{en ? "Optional: dress it up" : "Chaho toh: aur sajao"}</p>
            <div className="py-2">
              <p className="m-0 text-[15px] font-bold text-[#4a3f2e]">{en ? "Numbers (0 to 4)" : "Number (0 se 4)"}</p>
              <p className="m-0 text-[13px] text-[#5d5240]">{en ? "Only real numbers. They roll like a taxi meter. Tick sample if it is not real yet." : "Sirf asli number, meter ki tarah ghoomenge. Pakka nahi toh sample pe tick karo."}</p>
              {b.numbers.map((n, i) => (
                <div key={n.id} data-field={"numbers." + n.id} className="flex flex-wrap items-center gap-1 py-1 border-b border-kohl/10">
                  <select className="chip" value={n.prefix} aria-label={en ? "Before the number" : "Aage"} onChange={(e) => setBrief("Number badla", (x) => ({ ...x, numbers: x.numbers.map((q) => (q.id === n.id ? { ...q, prefix: e.target.value as NumberItem["prefix"] } : q)) }), "np" + n.id)}>{PREFIX.map((p) => <option key={p} value={p}>{p || (en ? "before" : "aage")}</option>)}</select>
                  <input type="number" inputMode="decimal" className={inputCls + " !w-24"} value={n.value} aria-label={`Number ${i + 1}`} onChange={(e) => setBrief("Number badla", (x) => ({ ...x, numbers: x.numbers.map((q) => (q.id === n.id ? { ...q, value: Number(e.target.value) || 0 } : q)) }), "nv" + n.id)} />
                  <select className="chip" value={n.suffix} aria-label={en ? "After the number" : "Peeche"} onChange={(e) => setBrief("Number badla", (x) => ({ ...x, numbers: x.numbers.map((q) => (q.id === n.id ? { ...q, suffix: e.target.value as NumberItem["suffix"] } : q)) }), "ns" + n.id)}>{SUFFIX.map((p) => <option key={p} value={p}>{p.trim() || (en ? "after" : "peeche")}</option>)}</select>
                  <input className={inputCls + " !w-36 flex-1"} value={n.label} maxLength={24} placeholder={en ? "Batches, years, seats" : "Batch, saal, seats"} aria-label={`Number ${i + 1} ${en ? "label" : "ka naam"}`} onBlur={touch("numbers." + n.id)} onChange={(e) => setBrief("Number ka naam", (x) => ({ ...x, numbers: x.numbers.map((q) => (q.id === n.id ? { ...q, label: e.target.value } : q)) }), "nl" + n.id)} />
                  <label className="flex items-center gap-1 min-h-[44px] text-[15px]"><input type="checkbox" className="w-5 h-5" checked={n.sample} onChange={(e) => setBrief("Sample tag", (x) => ({ ...x, numbers: x.numbers.map((q) => (q.id === n.id ? { ...q, sample: e.target.checked } : q)) }), "nk" + n.id)} />sample</label>
                  <button type="button" className="chip" onClick={() => setBrief("Number hataya", (x) => ({ ...x, numbers: x.numbers.filter((q) => q.id !== n.id) }), "nr")} aria-label={en ? "Remove number" : "Number hatao"}>×</button>
                </div>
              ))}
              {b.numbers.length < 4 && <button type="button" className="chip mt-2" onClick={() => setBrief("Number joda", (x) => ({ ...x, numbers: [...x.numbers, { id: "n" + nanoid(5), value: 10, prefix: "", suffix: "+", label: "", sample: false }] }), "nadd")}>+ Number</button>}
            </div>
            <Line label={en ? "Offer: old price, new price, until when" : "Offer: purana daam, naya daam, kab tak"} id="offer" hint={en ? "Both prices give a price-cut scene. A date gives a countdown." : "Dono daam bharo toh daam-kata scene banega. Tareekh bharo toh ulti ginti."}>
              <div className="flex flex-wrap gap-2">
                <input type="number" className={inputCls + " !w-28"} placeholder="₹240" aria-label={en ? "Old price" : "Purana daam"} value={b.offer?.oldPrice ?? ""} onChange={(e) => setBrief("Purana daam", (x) => ({ ...x, offer: { ...x.offer, oldPrice: e.target.value === "" ? undefined : Number(e.target.value) } }), "op")} />
                <input type="number" className={inputCls + " !w-28"} placeholder="₹199" aria-label={en ? "New price" : "Naya daam"} value={b.offer?.newPrice ?? ""} onChange={(e) => setBrief("Naya daam", (x) => ({ ...x, offer: { ...x.offer, newPrice: e.target.value === "" ? undefined : Number(e.target.value) } }), "np")} />
                <input type="date" className={inputCls + " !w-44"} aria-label={en ? "Offer ends on" : "Offer kab tak"} value={b.offer?.endsOn ?? ""} onChange={(e) => setBrief("Offer ki tareekh", (x) => ({ ...x, offer: { ...x.offer, endsOn: e.target.value || undefined } }), "oe")} />
              </div>
            </Line>
          </div>
          <div data-third="3" className="paper-lines px-4 pb-4 border-x-2 border-b-2 border-kohl text-kohl" style={{ transformOrigin: "top", backfaceVisibility: "hidden" }}>
            <Line label={en ? "Brand colours (tin lids, up to 3)" : "Rang: tin ke dhakkan (3 tak)"} err={errors["colors.0"] || errors["colors.1"] || errors["colors.2"]} id="colors">
              <div className="flex flex-wrap gap-2 items-center">
                {TIN_LIDS.map((c) => {
                  const on = b.colors.includes(c);
                  return <button key={c} type="button" aria-pressed={on} aria-label={`Rang ${c}`} onClick={() => setBrief("Rang badla", (x) => ({ ...x, colors: on ? x.colors.filter((y) => y !== c) : [...x.colors, c].slice(-3) }), "col")}
                    className="w-[44px] h-[44px] rounded-full border-2 border-kohl cursor-pointer" style={{ background: c, boxShadow: on ? "0 0 0 3px var(--paper), 0 0 0 6px var(--kohl)" : "2px 2px 0 var(--kohl)" }} />;
                })}
                <input key={b.colors[0] || "none"} className={inputCls + " !w-28 mono"} aria-label={en ? "First colour as hex" : "Pehla rang hex"} defaultValue={b.colors[0] || ""} placeholder="#D7261E" onBlur={(e) => { touch("colors")(); setBrief("Hex rang", (x) => ({ ...x, colors: [e.target.value.trim(), ...x.colors.slice(1)].filter(Boolean) }), "hex"); }} />
                <button type="button" className="chip" onClick={fromLogo}>{en ? "Take from logo" : "Logo se lo"}</button>
              </div>
            </Line>
            <Line label="Phone" err={errors.phone} id="phone" hint={en ? "Shown on the last board, with a WhatsApp QR." : "Aakhri board pe dikhega, WhatsApp QR ke saath."}>
              <input className={inputCls} type="tel" inputMode="tel" value={b.cta.phone || ""} placeholder="+91 98xxx xxxxx" onBlur={touch("phone")} onChange={(e) => setBrief("Phone badla", (x) => ({ ...x, cta: { ...x.cta, phone: e.target.value } }), "ph")} />
            </Line>
            <Line label={en ? "Address" : "Pata"} id="address">
              <input className={inputCls} value={b.cta.address || ""} maxLength={120} placeholder="Gali no. 4, Station Road" onChange={(e) => setBrief("Pata badla", (x) => ({ ...x, cta: { ...x.cta, address: e.target.value } }), "ad")} />
            </Line>
            <Line label={en ? "Link (makes a QR code)" : "Link (QR banega)"} err={errors.url} id="url">
              <input className={inputCls} type="url" value={b.cta.url || ""} maxLength={120} placeholder="https://" onBlur={touch("url")} onChange={(e) => setBrief("Link badla", (x) => ({ ...x, cta: { ...x.cta, url: e.target.value } }), "url")} />
            </Line>
            <div className="py-2">
              <p className="m-0 text-[15px] font-bold text-[#4a3f2e]">{en ? "Shape" : "Naap"}</p>
              <div className="flex gap-3 items-end">
                {([["9:16", "Status, Reel"], ["1:1", "Post"], ["16:9", "YouTube"]] as const).map(([a, use]) => (
                  <button key={a} type="button" aria-pressed={doc.aspect === a} onClick={() => setDoc(`Naap ${a}`, (d) => ({ ...d, aspect: a }))} aria-label={`${a}, ${use}`}
                    className="flex flex-col items-center gap-1 bg-transparent border-0 p-0 cursor-pointer min-h-[44px]">
                    <span className={`border-2 border-kohl grid place-items-center text-[13px] font-bold ${doc.aspect === a ? "bg-kohl text-haldi" : "bg-chai text-kohl"}`}
                      style={{ width: a === "16:9" ? 78 : a === "1:1" ? 54 : 44, height: a === "9:16" ? 78 : a === "1:1" ? 54 : 44 }}>{a}</span>
                    <span className="text-[12px] leading-none">{use}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="py-2">
              <p className="m-0 text-[15px] font-bold text-[#4a3f2e]">{en ? "Length" : "Lambai"}</p>
              <div className="flex flex-wrap gap-2">
                {([10, 15, 30, 45, 60] as const).map((l) => <button key={l} type="button" className="chip mono" aria-pressed={doc.lengthSec === l} onClick={() => setDoc(`${l} sec`, (d) => rebrief({ ...d, lengthSec: l }, d.brief))}>{l}s</button>)}
              </div>
              {doc.lengthSec > 30 && <p className="m-0 mt-1 text-[13px]">{en ? "WhatsApp Status takes 30 seconds at most." : "WhatsApp Status pe 30 sec tak hi chalta hai."}</p>}
            </div>
          </div>
        </div>
      </div>

      {folding && <FoldChit brief={b} onDone={folding.done} />}
      {/* the stamp bar: the drummer stands at its left, Banao is the stamp at its right */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-kohl border-t-4 border-haldi">
        <div className="mx-auto max-w-[560px] flex items-center gap-3 pl-[84px] pr-3 py-2 min-h-[76px]">
          <div className="flex-1 min-w-0 text-chai leading-tight" role="status" aria-live="polite">
            {missing
              ? <><span className="block text-[13px] opacity-80">{en ? `${done} of 4 ready` : `${done}/4 taiyaar`}</span><span className="block font-bold text-[15px]">{missing}</span></>
              : <span className="block font-bold text-[15px]">{doc.scenes.length ? (en ? "Changes apply live. Make again to rebuild." : "Badlaav seedha lag gaye. Dobara banana ho toh dabao.") : (en ? "All set. Press Make." : "Sab taiyaar. Banao dabao!")}</span>}
          </div>
          <button type="button" onClick={banao} disabled={busy} aria-disabled={!!missing || undefined}
            className={`tin-btn mirchi text-[22px] font-display px-6 rotate-[-3deg] shrink-0 ${missing ? "opacity-70" : ""}`}>
            {doc.scenes.length ? (en ? "Make again" : "Phir banao") : (en ? "Make" : "Banao")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** What the folding chit shows: the brief as it was written, in the hand of the parchi. */
function ChitFace({ brief }: { brief: Brief }) {
  const pts = brief.points.filter((p) => p.text.trim()).slice(0, 4);
  return (
    <div className="paper-lines h-full px-4 pt-3 text-kohl">
      <p className="m-0 font-display text-[24px] leading-[1.15] truncate">{brief.name}</p>
      <p className="m-0 mt-1 text-[15px] leading-snug line-clamp-2">{brief.oneLiner}</p>
      <ul className="m-0 mt-3 p-0 list-none flex flex-col gap-1.5">
        {pts.map((p, i) => <li key={p.id} className="text-[15px] leading-snug truncate"><span className="font-poster text-mirchi mr-2">{i + 1}.</span>{p.text}</li>)}
      </ul>
      <p className="m-0 mt-3 inline-block bg-haldi border-2 border-kohl px-2 font-bold text-[15px]">{brief.cta.text}</p>
    </div>
  );
}

/**
 * Banao, made visible: a parchi-sized chit folds in thirds on paper hinges (bottom flap up, then top flap down,
 * each 220 ms at perspective 1600), then drops along a short toss arc into the drummer's dhol while he beats
 * three times. Any tap or key skips straight to the wall.
 */
function FoldChit({ brief, onDone }: { brief: Brief; onDone: () => void }) {
  const [scope, animate] = useAnimate();
  const { setDrum, beat } = useShell();
  const [W] = useState(() => Math.min(320, window.innerWidth - 48));
  const T = 128;
  useEffect(() => {
    let alive = true;
    const off = () => { window.removeEventListener("keydown", end); window.removeEventListener("pointerdown", end); };
    function end() { if (!alive) return; alive = false; off(); onDone(); }
    window.addEventListener("keydown", end); window.addEventListener("pointerdown", end);
    const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
    (async () => {
      await wait(60);
      await animate("[data-flap='3']", { rotateX: -180 }, { duration: 0.22, ease: [0.65, 0, 0.35, 1] });
      if (!alive) return;
      await animate("[data-flap='1']", { rotateX: 180 }, { duration: 0.22, ease: [0.65, 0, 0.35, 1] });
      if (!alive || !scope.current) return;
      const box = (scope.current as HTMLElement).getBoundingClientRect();
      const dhol = document.querySelector(".drum-dock .d-dhol")?.getBoundingClientRect();
      const tx = dhol ? dhol.left + dhol.width / 2 : 44, ty = dhol ? dhol.top + dhol.height / 2 : window.innerHeight - 40;
      const dx = tx - (box.left + box.width / 2), dy = ty - (box.top + box.height / 2);
      setDrum("beat");
      // x glides out fast, y first lifts and then falls: two eases on two axes draw the arc
      await Promise.all([
        animate(scope.current, { x: dx }, { duration: 0.38, ease: [0.25, 0.1, 0.4, 1] }),
        animate(scope.current, { y: dy }, { duration: 0.38, ease: [0.45, -0.55, 0.85, 0.6] }),
        animate(scope.current, { scale: 0.25, rotate: -24 }, { duration: 0.38, ease: [0.4, 0, 0.6, 1] }),
      ]);
      if (!alive) return;
      animate(scope.current, { scale: 0.05, opacity: 0 }, { duration: 0.09 });
      beat(); await wait(120); beat(); await wait(120); beat(); await wait(260);
      end();
    })();
    return () => { alive = false; off(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fixed inset-0 z-[35] pointer-events-none" aria-hidden>
      <div className="absolute left-1/2 top-[46%]" style={{ width: W, height: 3 * T, marginLeft: -W / 2, marginTop: -1.5 * T }}>
        <div ref={scope} className="relative w-full h-full" style={{ perspective: 1600 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} data-flap={i} className="absolute inset-x-0" style={{ top: (i - 1) * T, height: T, transformOrigin: i === 1 ? "50% 100%" : "50% 0%", transformStyle: "preserve-3d", zIndex: i === 2 ? 1 : i === 3 ? 2 : 3 }}>
              {/* the torn top edge rides on the top flap's front */}
              {i === 1 && <svg viewBox="0 0 100 6" preserveAspectRatio="none" className="absolute left-0 right-0 -top-3 w-full h-3" style={{ backfaceVisibility: "hidden" }}><path d="M0 6 L0 3 L4 1 L8 4 L13 0 L18 3 L24 1 L29 4 L35 0 L41 3 L47 1 L53 4 L58 0 L64 3 L70 1 L76 4 L82 0 L88 3 L94 1 L100 4 L100 6Z" fill="var(--paper)" /></svg>}
              <div className={`absolute inset-0 overflow-hidden border-x-2 border-kohl ${i === 3 ? "border-b-2" : ""}`} style={{ backfaceVisibility: "hidden" }}>
                <div className="absolute inset-x-0" style={{ top: -(i - 1) * T, height: 3 * T }}><ChitFace brief={brief} /></div>
              </div>
              {i !== 2 && <div className="absolute inset-0 border-2 border-kohl bg-[#efe1c3] bg-[repeating-linear-gradient(180deg,transparent_0_21px,rgba(0,112,122,.14)_21px_22px)]" style={{ backfaceVisibility: "hidden", transform: "rotateX(180deg)" }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

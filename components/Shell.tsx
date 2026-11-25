"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { STRINGS, type Lang, type StrKey } from "@/lib/strings";
import { Drummer, type DrumState } from "./Drummer";

type Ctx = {
  lang: Lang; setLang: (l: Lang) => void; t: (k: StrKey) => string;
  calm: boolean; setCalm: (c: boolean) => void;
  announce: (s: string) => void;
  drum: DrumState; setDrum: (s: DrumState, chit?: string) => void; beat: () => void;
  toast: (msg: string, action?: { label: string; run: () => void }) => void;
};
const C = createContext<Ctx | null>(null);
export const useShell = () => useContext(C)!;

function readLS(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function writeLS(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } }

export function Shell({ children }: { children: React.ReactNode }) {
  const [lang, setLangS] = useState<Lang>("hi-Latn");
  const [calm, setCalmS] = useState(false);
  const [msg, setMsg] = useState("");
  const [drum, setDrumS] = useState<DrumState>("idle");
  const [chit, setChit] = useState<string | null>(null);
  const [beatN, setBeatN] = useState(0);
  const [toastS, setToast] = useState<{ msg: string; action?: { label: string; run: () => void }; id: number } | null>(null);
  const tRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const l = readLS("dh.lang"); if (l === "en" || l === "hi-Latn") setLangS(l);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const c = readLS("dh.calm") === "1" || reduce; setCalmS(c);
    const th = readLS("dh.theme"); if (th === "dark" || th === "light") document.documentElement.dataset.theme = th;
    // offline-first: the service worker caches the shell, chunks, fonts and the player
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  useEffect(() => { document.documentElement.classList.toggle("calm", calm); }, [calm]);

  const setLang = useCallback((l: Lang) => { setLangS(l); writeLS("dh.lang", l); }, []);
  const setCalm = useCallback((c: boolean) => { setCalmS(c); writeLS("dh.calm", c ? "1" : "0"); }, []);
  const announce = useCallback((s: string) => { setMsg(""); requestAnimationFrame(() => setMsg(s)); }, []);
  const setDrum = useCallback((s: DrumState, c?: string) => {
    setDrumS(s); setChit(c ?? null);
    const names: Record<DrumState, string> = { idle: "", drum: "Dhol baj raha hai: video ban rahi hai", beat: "Dhol pe teen thaap", nod: "Bhej diya", shrug: "Phone pe rakh liya, net aate hi bhej denge", wave: "Chhap gaya" };
    if (names[s]) announce(c || names[s]);
  }, [announce]);
  const beat = useCallback(() => setBeatN((n) => n + 1), []);
  const toast = useCallback((m: string, action?: { label: string; run: () => void }) => {
    window.clearTimeout(tRef.current);
    setToast({ msg: m, action, id: Date.now() });
    announce(m);
    tRef.current = window.setTimeout(() => setToast(null), 6000);
  }, [announce]);

  const value = useMemo<Ctx>(() => ({
    lang, setLang, t: (k) => STRINGS[k][lang], calm, setCalm, announce, drum, setDrum, beat, toast,
  }), [lang, setLang, calm, setCalm, announce, drum, setDrum, beat, toast]);

  return (
    <C.Provider value={value}>
      {children}
      <Drummer state={drum} chit={chit} calm={calm} beatSignal={beatN} />
      <div aria-live="polite" role="status" className="sr-only">{msg}</div>
      {toastS && (
        <div key={toastS.id} className="fixed left-1/2 -translate-x-1/2 bottom-[150px] z-50 flex items-center gap-3 bg-kohl text-chai px-4 py-2 border-2 border-chai max-w-[92vw]" style={{ boxShadow: "4px 4px 0 var(--haldi)" }}>
          <span>{toastS.msg}</span>
          {toastS.action && <button className="tin-btn" onClick={() => { toastS.action!.run(); setToast(null); }}>{toastS.action.label}</button>}
        </div>
      )}
    </C.Provider>
  );
}

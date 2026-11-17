"use client";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useShell } from "./Shell";

const RIBS = 12;
const EASE = [0.65, 0, 0.35, 1] as const;

/** SHUTTER UP: the session gate. Every gesture opens it; nothing traps scrolling. */
export function Gate() {
  const { calm, setDrum, beat } = useShell();
  const [state, setState] = useState<"closed" | "opening" | "open">("closed");
  const openedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const y = useMotionValue(0);
  const ribScale = useTransform(y, [0, -40, -100], [1, 0.6, 0.35]);
  const signY = useMotionValue(0);
  const fade = useMotionValue(1);
  const yPct = useTransform(y, (v) => `${v}%`);
  const signPct = useTransform(signY, (v) => `${v}%`);

  const open = useCallback(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    setState("opening");
    try { sessionStorage.setItem("dh.gate", "1"); } catch { /* storage blocked: open anyway */ }
    const done = () => {
      setState("open");
      document.documentElement.style.overflow = "";
      (document.getElementById("naya-shop") as HTMLElement | null)?.focus({ preventScroll: true });
    };
    if (calm) { animate(fade, 0, { duration: 0.2 }).then(done); return; }
    animate(y, [0, -103], { duration: 1.1, ease: EASE }).then(() => animate(y, -100, { type: "spring", stiffness: 420, damping: 34 }));
    setTimeout(() => animate(signY, -110, { duration: 0.9, ease: EASE }), 150);
    setTimeout(() => { setDrum("beat"); beat(); setTimeout(beat, 140); }, 650);
    setTimeout(() => { setDrum("idle"); done(); }, 1300);
  }, [calm, fade, y, signY, setDrum, beat]);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem("dh.gate") === "1"; } catch { seen = true; }
    if (seen) { openedRef.current = true; setState("open"); return; }
    const root = document.documentElement;
    root.style.overflow = "hidden";
    btnRef.current?.focus({ preventScroll: true });
    let sy: number | null = null;
    const onKey = (e: KeyboardEvent) => { if (["ArrowUp", "ArrowDown", "PageDown", " ", "Enter", "End", "Spacebar"].includes(e.key)) open(); };
    const onWheel = (e: WheelEvent) => { if (Math.abs(e.deltaY) > 4) open(); };
    const onTs = (e: TouchEvent) => { sy = e.touches[0]?.clientY ?? null; };
    const onTm = (e: TouchEvent) => { if (sy != null && sy - (e.touches[0]?.clientY ?? sy) > 24) open(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTs, { passive: true });
    window.addEventListener("touchmove", onTm, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey); window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTs); window.removeEventListener("touchmove", onTm);
      root.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const replay = () => {
      openedRef.current = false;
      y.set(0); signY.set(0); fade.set(1);
      try { sessionStorage.removeItem("dh.gate"); } catch { /* ignore */ }
      document.documentElement.classList.remove("gate-seen");
      setState("closed");
      document.documentElement.style.overflow = "hidden";
      setTimeout(() => btnRef.current?.focus({ preventScroll: true }), 30);
      const onKey = (e: KeyboardEvent) => { if (["ArrowUp", "ArrowDown", "PageDown", " ", "Enter", "End"].includes(e.key)) { window.removeEventListener("keydown", onKey); open(); } };
      setTimeout(() => window.addEventListener("keydown", onKey), 60);
    };
    window.addEventListener("dh-replay-gate", replay);
    return () => window.removeEventListener("dh-replay-gate", replay);
  }, [open, y, signY, fade]);

  if (state === "open") return null;
  return (
    <motion.div ref={rootRef} className="gate" style={{ opacity: fade }} data-gate={state} onClick={open}>
      {/* dusk lane behind the shutter */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[16%] plank border-t-4 border-kohl" />
      <motion.div className="gate-shutter shutter-steel border-x-4 border-kohl" style={{ y: yPct }} aria-hidden>
        {Array.from({ length: RIBS }, (_, i) => (
          <motion.div key={i} className="rib shutter-steel" style={{ scaleY: ribScale }} transition={{ delay: (RIBS - i) * 0.03 }} />
        ))}
        <div className="h-5 bg-kohl" />
      </motion.div>
      <motion.div className="gate-sign" style={{ y: signPct }}>
        <div className="bg-[#0F5E3A] border-4 border-kohl hard-lg px-6 py-4 text-center w-[min(88vw,520px)]">
          <h1 className="m-0 font-display text-chai leading-none text-[clamp(44px,13vw,88px)]">
            ढिंढोरा
            <span className="block text-[clamp(26px,7vw,46px)] text-haldi mt-1">Dhindhora</span>
          </h1>
        </div>
      </motion.div>
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[19%] flex flex-col items-center gap-3 w-[min(92vw,520px)] text-center z-[3]">
        <p className="m-0 bg-kohl text-chai px-3 py-1 text-[17px] font-bold">Apni dukaan ka dhindhora peeto</p>
        <button ref={btnRef} type="button" className="tin-btn text-[18px]" onClick={(e) => { e.stopPropagation(); open(); }}>Shutter uthao</button>
      </div>
    </motion.div>
  );
}

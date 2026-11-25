"use client";
import { useEffect, useRef, useState } from "react";

export type DrumState = "idle" | "drum" | "beat" | "nod" | "shrug" | "wave";

/** The dhindhora-wala: six flat SVG parts rigged with CSS transforms around their joints. */
export function Drummer({ state, chit, calm, beatSignal }: { state: DrumState; chit: string | null; calm: boolean; beatSignal: number }) {
  const [hit, setHit] = useState(false);
  const last = useRef(beatSignal);
  useEffect(() => {
    if (calm || beatSignal === last.current) { last.current = beatSignal; return; }
    last.current = beatSignal;
    setHit(true);
    const id = setTimeout(() => setHit(false), 60);
    return () => clearTimeout(id);
  }, [beatSignal, calm]);
  const [beatStep, setBeatStep] = useState(0);
  useEffect(() => {
    if (state !== "beat" && state !== "wave" || calm) return;
    let n = 0;
    const id = setInterval(() => { n++; setBeatStep(n); if (n >= 6) clearInterval(id); }, state === "beat" ? 120 : 160);
    return () => clearInterval(id);
  }, [state, calm]);
  const tr = calm ? "none" : "transform 120ms cubic-bezier(.3,.7,.4,1)";
  const stickDown = !calm && (hit || (state === "beat" && beatStep % 2 === 1) || (state === "drum" && hit));
  const head = !calm && state === "nod" ? "rotate(12deg)" : "none";
  const armsUp = !calm && state === "shrug";
  const wave = !calm && state === "wave" && beatStep % 2 === 1;
  const label = { idle: "Dhindhora-wala khada hai", drum: "Dhindhora-wala dhol baja raha hai", beat: "Dhindhora-wala ne thaap di", nod: "Dhindhora-wala ne sir hilaya: bhej diya", shrug: "Dhindhora-wala ne kandhe uchkaaye: phone pe rakh liya", wave: "Dhindhora-wala haath hila raha hai" }[state];
  return (
    <div className="drum-dock pointer-events-none select-none" style={{ width: 72, height: 72 }}>
      {chit && (
        <div className="absolute left-14 bottom-12 w-48 bg-chai text-kohl text-[15px] leading-tight px-2 py-1 border-2 border-kohl hard">{chit}</div>
      )}
      <svg role="img" aria-label={label} data-state={state} className="drummer h-16 w-16 md:h-[88px] md:w-[88px]" viewBox="0 0 64 64">
        <g className="drummer-part d-legs"><rect x="25" y="46" width="5" height="16" fill="#1B1A17" /><rect x="33" y="46" width="5" height="16" fill="#1B1A17" /></g>
        <g className="drummer-part d-torso"><path d="M22 26 h20 l2 22 h-24z" fill="#D7261E" stroke="#1B1A17" strokeWidth="1.5" /><path d="M22 30 h20" stroke="#F2B705" strokeWidth="2" /></g>
        <g className="drummer-part d-head" style={{ transformOrigin: "32px 24px", transform: head, transition: calm ? "none" : "transform 280ms cubic-bezier(.34,1.56,.64,1)" }}>
          <circle cx="32" cy="16" r="8" fill="#B7794A" stroke="#1B1A17" strokeWidth="1.5" />
          <path d="M23 13 q9 -9 18 0 l-2 -1 q-7 -4 -14 0z" fill="#F07F13" stroke="#1B1A17" strokeWidth="1" />
          <circle cx="35" cy="16" r="1" fill="#1B1A17" />
        </g>
        <g className="drummer-part d-arm-l" style={{ transformOrigin: "23px 28px", transform: armsUp ? "rotate(-120deg)" : "rotate(20deg)", transition: tr }}>
          <rect x="21" y="28" width="4" height="13" fill="#B7794A" stroke="#1B1A17" strokeWidth="1" />
        </g>
        <g className="drummer-part d-dhol"><rect x="18" y="38" width="28" height="12" rx="6" fill="#F2B705" stroke="#1B1A17" strokeWidth="1.5" /><path d="M24 38 l4 12 M30 38 l4 12 M36 38 l4 12" stroke="#1B1A17" strokeWidth="1" /></g>
        <g className="drummer-part d-arm-r" style={{ transformOrigin: "41px 28px", transform: armsUp ? "rotate(120deg)" : wave ? "rotate(-150deg)" : stickDown ? "rotate(-10deg)" : "rotate(-45deg)", transition: tr }}>
          <rect x="39" y="28" width="4" height="13" fill="#B7794A" stroke="#1B1A17" strokeWidth="1" />
          <rect x="40" y="39" width="2" height="12" fill="#1B1A17" transform="rotate(-30 41 40)" />
        </g>
      </svg>
    </div>
  );
}

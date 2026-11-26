"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Munim ji's desk: a red cloth bahi-khata on a low desk, and a brass stamp. */
export default function SignIn() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg("");
    const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, name: name || undefined, mode }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.message || "Nahi hua"); return; }
    const next = new URLSearchParams(location.search).get("next");
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
  };
  return (
    <div className="min-h-svh bg-dusk flex flex-col items-center justify-end overflow-x-clip">
      <div className="w-full flex justify-start px-4 py-3"><Link href="/" className="font-display text-[24px] text-chai no-underline min-h-[44px] flex items-center">ढिंढोरा</Link></div>
      <div className="flex-1" />
      <form onSubmit={submit} className="relative w-[min(92vw,460px)] bg-[#8f1d1d] border-4 border-kohl hard-lg p-3 -mb-6 z-10">
        <div className="paper-lines border-2 border-kohl p-4 text-kohl">
          <h1 className="m-0 font-display text-[30px]">Munim ji ki bahi</h1>
          <p className="mt-1 mb-3 text-[15px]">Account se jodo, taaki phone badle toh bhi dukaanein na khoyein. Abhi tak ki saari dukaanein aapke naam ho jayengi.</p>
          {mode === "signup" && <label className="block py-1"><span className="text-[15px] font-bold">Naam</span><input className="w-full min-h-[44px] bg-transparent border-0 border-b-2 border-kohl/40 text-[17px] outline-none" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" /></label>}
          <label className="block py-1"><span className="text-[15px] font-bold">Email</span><input type="email" required className="w-full min-h-[44px] bg-transparent border-0 border-b-2 border-kohl/40 text-[17px] outline-none" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <label className="block py-1"><span className="text-[15px] font-bold">Password (kam se kam 8)</span><input type="password" required minLength={8} className="w-full min-h-[44px] bg-transparent border-0 border-b-2 border-kohl/40 text-[17px] outline-none" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} /></label>
          {msg && <p className="m-0 mt-2 text-mirchi font-bold" role="alert">{msg}</p>}
          <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
            {/* the brass stamp: a turned handle over a round die */}
            <button type="submit" disabled={busy} className="group flex items-center gap-2 min-h-[56px] pl-1 pr-5 bg-[#c9a227] border-2 border-kohl rounded-full hard font-display text-[20px] text-kohl whitespace-nowrap cursor-pointer active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-70">
              <svg aria-hidden viewBox="0 0 40 48" className="w-[34px] h-[42px] transition-transform duration-150 group-active:translate-y-[3px]"><ellipse cx="20" cy="9" rx="9" ry="7" fill="#8a5a2b" stroke="#1B1A17" strokeWidth="2" /><rect x="16" y="14" width="8" height="16" fill="#8a5a2b" stroke="#1B1A17" strokeWidth="2" /><rect x="6" y="30" width="28" height="9" rx="2" fill="#e0b84a" stroke="#1B1A17" strokeWidth="2" /><rect x="8" y="39" width="24" height="5" fill="#D7261E" stroke="#1B1A17" strokeWidth="1.5" /></svg>
              {busy ? "..." : mode === "signin" ? "Andar aao" : "Khaata kholo"}
            </button>
            <button type="button" className="chip" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "Naya khaata" : "Pehle se khaata hai"}</button>
          </div>
          <p className="m-0 mt-3 text-[13px]">Khaata email aur password se khulta hai. Password kisi ko nahi dikhta, humein bhi nahi.</p>
        </div>
      </form>
      <div className="w-full h-[28vh] plank border-t-4 border-kohl" aria-hidden />
    </div>
  );
}

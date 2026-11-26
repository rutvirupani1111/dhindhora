"use client";
import { create } from "zustand";
import type { Doc } from "@/packages/renderer/core";
import { relayout, setQrEncoder } from "@/packages/renderer/layout";
import qrcode from "qrcode-generator";
import { idb, type HistEntry } from "./idb";

setQrEncoder((text) => {
  try {
    const q = qrcode(0, "M"); q.addData(text); q.make();
    const n = q.getModuleCount(); let bits = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) bits += q.isDark(r, c) ? "1" : "0";
    return { n, bits };
  } catch { return undefined; }
});

export type SyncState = "idle" | "local" | "sending" | "sent" | "failed" | "conflict";
const HIST_CAP = 200;
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Three-way merge by brief field and scene id. A side that changed alone wins; both changed = conflict. */
export function merge3(base: Doc, mine: Doc, theirs: Doc): { doc: Doc; conflicts: string[] } {
  const conflicts: string[] = [];
  const pick = <T,>(k: string, b: T, m: T, t: T): T => {
    if (eq(m, b)) return t; if (eq(t, b) || eq(m, t)) return m;
    conflicts.push(k); return m;
  };
  const brief = { ...mine.brief } as any;
  for (const k of new Set([...Object.keys(base.brief), ...Object.keys(mine.brief), ...Object.keys(theirs.brief)])) {
    brief[k] = pick("brief." + k, (base.brief as any)[k], (mine.brief as any)[k], (theirs.brief as any)[k]);
  }
  const ids = new Set([...mine.scenes.map((s) => s.id), ...theirs.scenes.map((s) => s.id)]);
  const byId = (d: Doc, id: string) => d.scenes.find((s) => s.id === id);
  const merged = new Map<string, Doc["scenes"][number]>();
  for (const id of ids) {
    const b = byId(base, id), m = byId(mine, id), t = byId(theirs, id);
    if (m && t) merged.set(id, pick("scene." + id, b as typeof m | undefined, m, t) as typeof m);
    else if (m && !t) { if (!b || !eq(b, m)) merged.set(id, m); }
    else if (t && !m) { if (!b || !eq(b, t)) merged.set(id, t); }
  }
  const order = eq(mine.scenes.map((s) => s.id), base.scenes.map((s) => s.id)) ? theirs.scenes.map((s) => s.id) : mine.scenes.map((s) => s.id);
  for (const id of merged.keys()) if (!order.includes(id)) order.push(id);
  const doc: Doc = {
    ...mine, brief,
    style: pick("style", base.style, mine.style, theirs.style),
    aspect: pick("aspect", base.aspect, mine.aspect, theirs.aspect),
    lengthSec: pick("lengthSec", base.lengthSec, mine.lengthSec, theirs.lengthSec),
    seed: pick("seed", base.seed, mine.seed, theirs.seed),
    scenes: order.map((id) => merged.get(id)).filter(Boolean) as Doc["scenes"],
  };
  return { doc, conflicts };
}

type S = {
  id: string | null; doc: Doc | null; version: number; base: Doc | null;
  past: HistEntry[]; future: HistEntry[];
  sync: SyncState; serverVersion: number; publishedVersion: number | null; visibility: string; status: string;
  conflict: { mine: Doc; theirs: Doc; version: number } | null;
  load: (id: string, doc: Doc, version: number, base: Doc | null, meta?: { visibility?: string; status?: string; publishedVersion?: number | null }) => Promise<void>;
  commit: (label: string, fn: (d: Doc) => Doc, opts?: { coalesce?: string }) => void;
  undo: () => void; redo: () => void; jump: (pastIndex: number) => void;
  setMeta: (m: Partial<Pick<S, "visibility" | "status" | "publishedVersion">>) => void;
  resolveConflict: (keep: "mine" | "theirs") => void;
  flush: () => Promise<void>;
};

let syncTimer: number | undefined;
let histTimer: number | undefined;
let retryN = 0;
// one save at a time: a second PUT racing the first would carry a stale baseVersion, get a 409 and
// show the person a conflict with their own half-typed words. The request in flight re-schedules itself
// when the doc moved on while it was out; anyone who must see the latest save (publish, render) waits for it.
let inflight: Promise<void> | null = null;
let lastCoalesce: { key: string; at: number } | null = null;
const BACKOFF = [2000, 5000, 15000, 60000];

export const useStudio = create<S>((set, get) => {
  const persist = () => {
    const s = get(); if (!s.id || !s.doc) return;
    idb.putDoc({ id: s.id, doc: s.doc, version: s.version, base: s.base, dirty: s.sync !== "sent" && s.sync !== "idle", updatedAt: Date.now(), visibility: s.visibility, status: s.status, publishedVersion: s.publishedVersion });
    window.clearTimeout(histTimer);
    histTimer = window.setTimeout(() => { const t = get(); if (t.id) idb.putHist({ id: t.id, past: t.past, future: t.future }); }, 500);
  };
  const schedule = (ms = 700) => { window.clearTimeout(syncTimer); syncTimer = window.setTimeout(() => get().flush(), ms); };
  if (typeof window !== "undefined") window.addEventListener("online", () => { retryN = 0; schedule(50); });

  return {
    id: null, doc: null, version: 0, base: null, past: [], future: [], sync: "idle", serverVersion: 0, publishedVersion: null, visibility: "private", status: "draft", conflict: null,
    async load(id, doc, version, base, meta) {
      const h = await idb.getHist(id);
      set({ id, doc: relayout(doc, undefined, Date.now()), version, base: base || doc, past: h?.past || [], future: h?.future || [], sync: "idle", serverVersion: version, conflict: null, visibility: meta?.visibility || "private", status: meta?.status || "draft", publishedVersion: meta?.publishedVersion ?? null });
    },
    commit(label, fn, opts) {
      const s = get(); if (!s.doc) return;
      const next = relayout(fn(s.doc), undefined, Date.now());
      if (next === s.doc) return;
      const now = Date.now();
      const co = opts?.coalesce && lastCoalesce && lastCoalesce.key === opts.coalesce && now - lastCoalesce.at < 1200;
      lastCoalesce = opts?.coalesce ? { key: opts.coalesce, at: now } : null;
      let past = s.past;
      if (co && past.length) past = [...past.slice(0, -1), { ...past[past.length - 1], label }];
      else past = [...past, { label, doc: s.doc }].slice(-HIST_CAP);
      set({ doc: next, past, future: [], sync: "local" });
      persist(); schedule();
    },
    undo() {
      const s = get(); if (!s.doc || !s.past.length) return;
      const prev = s.past[s.past.length - 1];
      set({ doc: prev.doc, past: s.past.slice(0, -1), future: [{ label: prev.label, doc: s.doc }, ...s.future], sync: "local" });
      lastCoalesce = null; persist(); schedule();
    },
    redo() {
      const s = get(); if (!s.doc || !s.future.length) return;
      const nx = s.future[0];
      set({ doc: nx.doc, future: s.future.slice(1), past: [...s.past, { label: nx.label, doc: s.doc }], sync: "local" });
      persist(); schedule();
    },
    jump(i) {
      const s = get(); if (!s.doc) return;
      if (i < 0 || i >= s.past.length) return;
      const target = s.past[i];
      const moved = [...s.past.slice(i + 1), { label: "Abhi", doc: s.doc }];
      // walking back i entries: each moved entry goes to the redo stack in order
      const future = moved.map((e, k) => ({ label: s.past[i + k]?.label ?? e.label, doc: e.doc })).concat(s.future);
      set({ doc: target.doc, past: s.past.slice(0, i), future, sync: "local" });
      persist(); schedule();
    },
    setMeta(m) { set(m as Partial<S>); persist(); },
    resolveConflict(keep) {
      const c = get().conflict; if (!c) return;
      const doc = keep === "mine" ? c.mine : c.theirs;
      set({ doc, base: c.theirs, version: c.version, conflict: null, sync: "local" });
      persist(); schedule(10);
    },
    async flush(): Promise<void> {
      if (inflight) { await inflight; return get().flush(); }
      const s = get(); if (!s.id || !s.doc || s.conflict) return;
      if (s.sync !== "local" && s.sync !== "failed") return;
      if (typeof navigator !== "undefined" && !navigator.onLine) { set({ sync: "local" }); return; }
      const sent = s.doc;
      // only the edits that were in this doc get the server tick in the bahi
      const sentLen = s.past.length;
      let release!: () => void;
      inflight = new Promise<void>((ok) => { release = ok; });
      set({ sync: "sending" });
      try {
        let r: Response;
        if (s.version === 0) {
          r = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: s.id, doc: sent }) });
        } else {
          r = await fetch(`/api/projects/${s.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseVersion: s.version, doc: sent }) });
        }
        const j = await r.json().catch(() => ({}));
        if (r.status === 409 && s.version > 0 && j.doc) {
          const { doc, conflicts } = merge3(s.base || sent, get().doc!, j.doc);
          if (conflicts.length) { set({ conflict: { mine: get().doc!, theirs: j.doc, version: j.version }, sync: "conflict" }); return; }
          set({ doc: relayout(doc, undefined, Date.now()), base: j.doc, version: j.version, sync: "local" });
          persist(); schedule(10); return;
        }
        if (!r.ok) throw new Error(j.error || "save_failed");
        retryN = 0;
        const still = get().doc === sent;
        set({
          version: j.version, base: sent, serverVersion: j.version, sync: still ? "sent" : "local",
          past: get().past.map((e, i) => (i < sentLen ? { ...e, confirmed: true, failed: false } : e)),
        });
        persist();
        if (!still) schedule(300);
        window.dispatchEvent(new CustomEvent("dh-saved", { detail: { version: j.version } }));
      } catch {
        set({ sync: navigator.onLine ? "failed" : "local", past: get().past.map((e) => (e.confirmed ? e : { ...e, failed: true })) });
        persist();
        const wait = BACKOFF[Math.min(retryN++, BACKOFF.length - 1)];
        window.dispatchEvent(new CustomEvent("dh-offline"));
        schedule(wait);
      } finally {
        inflight = null; release();
      }
    },
  };
});

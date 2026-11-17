// Tiny IndexedDB wrapper. The phone copy is a cache and an offline queue; the server is the source of truth.
import type { Doc } from "@/packages/renderer/core";

export type Local = { id: string; doc: Doc; version: number; base: Doc | null; dirty: boolean; updatedAt: number; visibility?: string; status?: string; publishedVersion?: number | null };
export type HistEntry = { label: string; doc: Doc; confirmed?: boolean; failed?: boolean };
export type Hist = { id: string; past: HistEntry[]; future: HistEntry[] };

let dbp: Promise<IDBDatabase> | null = null;
function open() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open("dhindhora", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("docs", { keyPath: "id" }); r.result.createObjectStore("hist", { keyPath: "id" }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise((res, rej) => {
      const t = db.transaction(store, mode); const s = t.objectStore(store);
      const req = fn(s);
      t.oncomplete = () => res(req ? (req as IDBRequest<T>).result : undefined);
      t.onerror = () => rej(t.error);
    });
  } catch { return undefined; }
}
export const idb = {
  getDoc: (id: string) => tx<Local>("docs", "readonly", (s) => s.get(id)),
  putDoc: (v: Local) => tx("docs", "readwrite", (s) => { s.put(v); }),
  allDocs: () => tx<Local[]>("docs", "readonly", (s) => s.getAll()),
  delDoc: (id: string) => tx("docs", "readwrite", (s) => { s.delete(id); }),
  getHist: (id: string) => tx<Hist>("hist", "readonly", (s) => s.get(id)),
  putHist: (v: Hist) => tx("hist", "readwrite", (s) => { s.put(v); }),
};

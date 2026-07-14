"use client";

// ============================================================================
// Cola de ventas OFFLINE + cache de catálogo, en IndexedDB. Cuando se corta
// internet, la caja sigue cobrando en efectivo: la venta se guarda acá con un
// client_uid único y, al volver la conexión, se sincroniza (create_sale es
// idempotente por ese uid, así que reintentar no duplica).
// ============================================================================

const DB_NAME = "comercia-offline";
const DB_VERSION = 1;
const STORE_QUEUE = "queue";
const STORE_PRODUCTS = "products";

export type OfflineLine = { productId: string; qty: number };
export type OfflineSale = {
  uid: string;            // client_uid (idempotencia)
  branchId: string;
  method: "efectivo";     // offline SOLO efectivo
  lines: OfflineLine[];
  ref: string;            // "Ticket #…"
  total: number;          // informativo (para el resumen de la cola)
  createdAt: number;
  status: "pendiente" | "error";
  error?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("Sin IndexedDB")); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) db.createObjectStore(STORE_QUEUE, { keyPath: "uid" });
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) db.createObjectStore(STORE_PRODUCTS, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

// ---- Cola de ventas offline ----
export async function enqueueSale(sale: OfflineSale): Promise<void> {
  try { await tx(STORE_QUEUE, "readwrite", (s) => s.put(sale)); } catch { /* sin IndexedDB: se pierde */ }
}
export async function getQueue(): Promise<OfflineSale[]> {
  try { return (await tx<OfflineSale[]>(STORE_QUEUE, "readonly", (s) => s.getAll())) ?? []; } catch { return []; }
}
export async function removeSale(uid: string): Promise<void> {
  try { await tx(STORE_QUEUE, "readwrite", (s) => s.delete(uid)); } catch { /* noop */ }
}
export async function updateSale(sale: OfflineSale): Promise<void> {
  try { await tx(STORE_QUEUE, "readwrite", (s) => s.put(sale)); } catch { /* noop */ }
}
export async function queueCount(): Promise<number> {
  return (await getQueue()).length;
}

// ---- Cache del catálogo (para vender tras un refresh offline) ----
export async function cacheProducts(items: unknown[]): Promise<void> {
  try { await tx(STORE_PRODUCTS, "readwrite", (s) => s.put({ key: "catalog", items, at: Date.now() })); } catch { /* noop */ }
}
export async function getCachedProducts<T = unknown>(): Promise<T[]> {
  try {
    const row = await tx<{ items?: T[] } | undefined>(STORE_PRODUCTS, "readonly", (s) => s.get("catalog"));
    return row?.items ?? [];
  } catch { return []; }
}

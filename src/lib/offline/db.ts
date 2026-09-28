import { openDB, type DBSchema } from "idb";
import type { OfflineQueueEntry, PosCache } from "./types";

interface KenzhoOfflineDb extends DBSchema {
  posCache: { key: string; value: PosCache };
  outbox: {
    key: string;
    value: OfflineQueueEntry;
    indexes: { "by-store-created": [string, number]; "by-status": string };
  };
  meta: { key: string; value: { key: string; value: string | number } };
}

const dbPromise = openDB<KenzhoOfflineDb>("kenzho-offline-sales", 1, {
  upgrade(db) {
    db.createObjectStore("posCache", { keyPath: "storeId" });
    const outbox = db.createObjectStore("outbox", { keyPath: "clientTxnId" });
    outbox.createIndex("by-store-created", ["storeId", "createdAt"]);
    outbox.createIndex("by-status", "status");
    db.createObjectStore("meta", { keyPath: "key" });
  },
});

export async function getPosCache(storeId: string) {
  return (await dbPromise).get("posCache", storeId);
}

export async function mergePosCache(storeId: string, patch: Partial<PosCache>) {
  const db = await dbPromise;
  const existing = await db.get("posCache", storeId);
  const next: PosCache = {
    storeId,
    updatedAt: Date.now(),
    products: [], members: [], discounts: [], loyaltyRules: [], redemptionRules: [], bundlePromos: [], store: null,
    ...existing,
    ...patch,
    storeId,
    updatedAt: Date.now(),
  };
  await db.put("posCache", next);
  return next;
}

export async function addOutbox(entry: OfflineQueueEntry) {
  await (await dbPromise).put("outbox", entry);
}

export async function updateOutbox(entry: OfflineQueueEntry) {
  await (await dbPromise).put("outbox", entry);
}

export async function listOutbox(storeId?: string) {
  const rows = await (await dbPromise).getAll("outbox");
  return rows
    .filter((row) => !storeId || row.storeId === storeId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function pendingOutboxCount() {
  const rows = await listOutbox();
  return rows.filter((row) => row.status !== "sinkron").length;
}

export async function getDeviceIdentity() {
  const db = await dbPromise;
  const savedId = await db.get("meta", "device-id");
  const savedCode = await db.get("meta", "device-code");
  if (savedId && savedCode) return { deviceId: String(savedId.value), deviceCode: String(savedCode.value) };
  const deviceId = crypto.randomUUID();
  const deviceCode = `DV${deviceId.replaceAll("-", "").slice(0, 6).toUpperCase()}`;
  await db.put("meta", { key: "device-id", value: deviceId });
  await db.put("meta", { key: "device-code", value: deviceCode });
  return { deviceId, deviceCode };
}

export async function nextReceiptNumber() {
  const db = await dbPromise;
  const { deviceCode } = await getDeviceIdentity();
  const now = new Date();
  const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const key = `receipt-sequence-${day}`;
  const previous = await db.get("meta", key);
  const sequence = Number(previous?.value || 0) + 1;
  await db.put("meta", { key, value: sequence });
  return `${deviceCode}-${day}-${String(sequence).padStart(4, "0")}`;
}

export async function requestPersistentStorage() {
  try { await navigator.storage?.persist?.(); } catch { /* best effort */ }
}
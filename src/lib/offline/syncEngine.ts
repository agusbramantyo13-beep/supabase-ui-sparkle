import { supabase } from "@/integrations/supabase/client";
import { listOutbox, updateOutbox } from "./db";
import { isNetworkError } from "./network";
import type { OfflineQueueEntry } from "./types";

let running = false;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String((error as { message?: string })?.message || "Sinkronisasi gagal");
}

export async function syncOutbox(onChange?: () => void) {
  if (running || !navigator.onLine) return;
  running = true;
  onChange?.();
  try {
    const rows = (await listOutbox()).filter((row) => row.status === "menunggu");
    for (const row of rows) {
      if (!navigator.onLine) break;
      if (row.nextRetryAt > Date.now()) break;
      try {
        const { error } = await (supabase.rpc as any)("sync_offline_sale", { payload: row.payload });
        if (error) throw error;
        await updateOutbox({ ...row, status: "sinkron", errorMessage: undefined, updatedAt: Date.now() });
        window.dispatchEvent(new CustomEvent("kenzho-offline-synced", { detail: row.receiptNumber }));
      } catch (error) {
        const attempts = row.attempts + 1;
        const network = isNetworkError(error);
        const next: OfflineQueueEntry = {
          ...row,
          attempts,
          updatedAt: Date.now(),
          status: network ? "menunggu" : "gagal",
          errorMessage: errorMessage(error),
          nextRetryAt: Date.now() + Math.min(300_000, 2 ** Math.min(attempts, 8) * 1000),
        };
        await updateOutbox(next);
        onChange?.();
        if (network) break;
      }
      onChange?.();
    }
  } finally {
    running = false;
    onChange?.();
  }
}

export async function retryOutbox(entry: OfflineQueueEntry) {
  await updateOutbox({ ...entry, status: "menunggu", errorMessage: undefined, nextRetryAt: 0, updatedAt: Date.now() });
}
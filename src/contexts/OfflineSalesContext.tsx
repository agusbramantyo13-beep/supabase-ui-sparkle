import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { listOutbox, pendingOutboxCount, requestPersistentStorage } from "@/lib/offline/db";
import { syncOutbox } from "@/lib/offline/syncEngine";
import type { OfflineQueueEntry } from "@/lib/offline/types";

interface OfflineSalesContextValue {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  entries: OfflineQueueEntry[];
  refresh: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const OfflineSalesContext = createContext<OfflineSalesContextValue | null>(null);

export function OfflineSalesProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [entries, setEntries] = useState<OfflineQueueEntry[]>([]);

  const refresh = useCallback(async () => {
    const [count, rows] = await Promise.all([pendingOutboxCount(), listOutbox()]);
    setPendingCount(count);
    setEntries(rows);
  }, []);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try { await syncOutbox(refresh); } finally { setSyncing(false); await refresh(); }
  }, [refresh]);

  useEffect(() => {
    requestPersistentStorage();
    refresh();
    const handleOnline = () => { setOnline(true); void syncNow(); };
    const handleOffline = () => setOnline(false);
    const handleChanged = () => void refresh();
    const handleSynced = (event: Event) => {
      const receipt = (event as CustomEvent<string>).detail;
      toast.success(`Transaksi ${receipt} berhasil disinkronkan`);
      void refresh();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("kenzho-outbox-changed", handleChanged);
    window.addEventListener("kenzho-offline-synced", handleSynced);
    const timer = window.setInterval(() => { if (navigator.onLine) void syncNow(); }, 30_000);
    void syncNow();
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("kenzho-outbox-changed", handleChanged);
      window.removeEventListener("kenzho-offline-synced", handleSynced);
      window.clearInterval(timer);
    };
  }, [refresh, syncNow]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pendingCount > 0) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pendingCount]);

  return <OfflineSalesContext.Provider value={{ online, syncing, pendingCount, entries, refresh, syncNow }}>{children}</OfflineSalesContext.Provider>;
}

export function useOfflineSales() {
  const value = useContext(OfflineSalesContext);
  if (!value) throw new Error("useOfflineSales harus digunakan di dalam OfflineSalesProvider");
  return value;
}
import { RefreshCw, ReceiptText, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOfflineSales } from "@/contexts/OfflineSalesContext";
import { retryOutbox } from "@/lib/offline/syncEngine";
import { useBluetoothPrinter } from "@/contexts/BluetoothPrinterContext";
import { toast } from "sonner";
import { useStore } from "@/contexts/StoreContext";

export default function OfflineSales() {
  const { entries, online, syncing, syncNow, refresh } = useOfflineSales();
  const printer = useBluetoothPrinter();
  const { currentStoreId } = useStore();
  const visibleEntries = entries.filter((entry) => entry.storeId === currentStoreId);
  const retry = async (entry: (typeof entries)[number]) => { await retryOutbox(entry); await refresh(); await syncNow(); };
  const print = async (entry: (typeof entries)[number]) => {
    try {
      await printer.printReceipt({
        ...entry.receipt,
        receiptNumber: entry.receiptNumber,
        paymentMethod: entry.payload.payment_method,
        items: entry.payload.items.map((item) => ({ name: item.display_name, qty: item.quantity, price: item.unit_price, total: item.total })),
        subtotal: entry.payload.subtotal,
        discount: entry.payload.discount_total,
        tax: entry.payload.tax_total,
        total: entry.payload.total,
        cash: Number(entry.payload.payment_details.cash_amount || 0),
        card: Number(entry.payload.payment_details.card_amount || 0),
        change: Number(entry.payload.payment_details.change || 0),
        offlinePointsPending: Boolean(entry.payload.member_id && entry.status !== "sinkron"),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mencetak nota");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-semibold">Antrean Penjualan Offline</h1><p className="text-sm text-muted-foreground">Transaksi tersimpan aman di perangkat ini.</p></div>
        <Button onClick={syncNow} disabled={!online || syncing} className="gap-2"><RefreshCw className={syncing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Sinkronkan sekarang</Button>
      </div>
      {visibleEntries.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">Belum ada transaksi offline.</p> : visibleEntries.map((entry) => (
        <Card key={entry.clientTxnId}><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <ReceiptText className="h-5 w-5 text-muted-foreground" />
          <div className="min-w-0 flex-1"><p className="font-medium">{entry.receiptNumber}</p><p className="text-xs text-muted-foreground">{new Date(entry.clientCreatedAt).toLocaleString("id-ID")} · Rp {entry.payload.total.toLocaleString("id-ID")}</p>{entry.errorMessage && <p className="mt-1 text-xs text-destructive">{entry.errorMessage}</p>}</div>
          <Badge variant={entry.status === "gagal" ? "destructive" : entry.status === "sinkron" ? "secondary" : "outline"}>{entry.status}</Badge>
          <Button variant="outline" size="sm" onClick={() => print(entry)}>Cetak nota</Button>
          {entry.status === "gagal" && <Button size="sm" onClick={() => retry(entry)} className="gap-1"><RotateCcw className="h-3.5 w-3.5" />Coba lagi</Button>}
        </CardContent></Card>
      ))}
    </div>
  );
}
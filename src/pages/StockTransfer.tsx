import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Printer, Eye, ArrowRightLeft, ChevronsUpDown, Search } from "lucide-react";
import { format } from "date-fns";
import { applyInventoryChange } from "@/lib/stockHistory";

interface TransferItem {
  variant_id: number;
  product_name: string;
  variant_name: string;
  quantity: number;
}

interface TransferRecord {
  id: string;
  transfer_number: string;
  from_store_id: string;
  to_store_id: string;
  from_store_name?: string;
  to_store_name?: string;
  status: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  items?: { product_name: string; variant_name: string; quantity: number }[];
}

export default function StockTransfer() {
  const { currentStore, stores } = useStore();
  const { user } = useAuth();
  const { toast } = useToast();

  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState<TransferRecord | null>(null);

  // Form state
  const [toStoreId, setToStoreId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransferItem[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const otherStores = stores.filter((s) => s.id !== currentStore?.id);

  useEffect(() => {
    if (currentStore?.id) {
      fetchTransfers();
      fetchVariants();
    }
  }, [currentStore?.id]);

  const fetchVariants = async () => {
    const { data } = await supabase
      .from("variants")
      .select("id, name, product_id, products(name)")
      .eq("store_id", currentStore!.id);
    setVariants(data || []);
  };

  const fetchTransfers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("stock_transfers")
      .select("*")
      .or(`from_store_id.eq.${currentStore!.id},to_store_id.eq.${currentStore!.id}`)
      .order("created_at", { ascending: false });

    if (data) {
      const enriched = data.map((t: any) => ({
        ...t,
        from_store_name: stores.find((s) => s.id === t.from_store_id)?.name || t.from_store_id,
        to_store_name: stores.find((s) => s.id === t.to_store_id)?.name || t.to_store_id,
      }));
      setTransfers(enriched);
    }
    setLoading(false);
  };

  const addItem = () => {
    setItems([...items, { variant_id: 0, product_name: "", variant_name: "", quantity: 1 }]);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, variantId: number) => {
    const v = variants.find((vr: any) => vr.id === variantId);
    if (!v) return;
    const updated = [...items];
    updated[idx] = {
      variant_id: v.id,
      product_name: (v as any).products?.name || "-",
      variant_name: v.name,
      quantity: updated[idx].quantity,
    };
    setItems(updated);
  };

  const updateQuantity = (idx: number, qty: number) => {
    const updated = [...items];
    updated[idx].quantity = qty;
    setItems(updated);
  };

  const handleSubmit = async () => {
    if (!toStoreId) {
      toast({ title: "Error", description: "Pilih toko tujuan", variant: "destructive" });
      return;
    }
    if (items.length === 0 || items.some((i) => !i.variant_id || i.quantity <= 0)) {
      toast({ title: "Error", description: "Tambahkan item dengan qty valid", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const transferNumber = `MT-${Date.now().toString(36).toUpperCase()}`;

      const { data: transfer, error } = await supabase
        .from("stock_transfers")
        .insert({
          transfer_number: transferNumber,
          from_store_id: currentStore!.id,
          to_store_id: toStoreId,
          notes: notes || null,
          created_by: user?.id,
          status: "completed",
        })
        .select()
        .single();

      if (error) throw error;

      const transferItems = items.map((item) => ({
        transfer_id: transfer.id,
        variant_id: item.variant_id,
        product_name: item.product_name,
        variant_name: item.variant_name,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase.from("stock_transfer_items").insert(transferItems);
      if (itemsError) throw itemsError;

      // Decrease stock from source, increase in destination
      for (const item of items) {
        const { data: inv } = await supabase
          .from("inventory")
          .select("quantity")
          .eq("variant_id", item.variant_id)
          .eq("store_id", currentStore!.id)
          .maybeSingle();

        if (inv) {
          await applyInventoryChange({
            variantId: item.variant_id,
            newQuantity: Math.max(0, inv.quantity - item.quantity),
            type: "product_reduced",
            notes: `Mutasi keluar ke toko ${toStoreId}`,
          });
        }

        // For destination: helper checks store_id from variant; transfer must use dest store's variant.
        // Use raw update to remain consistent with existing behavior when dest variant lives in another store.
        const { data: destInv } = await supabase
          .from("inventory")
          .select("id, quantity")
          .eq("variant_id", item.variant_id)
          .eq("store_id", toStoreId)
          .maybeSingle();

        if (destInv) {
          await supabase
            .from("inventory")
            .update({ quantity: destInv.quantity + item.quantity })
            .eq("id", destInv.id);
        } else {
          await supabase.from("inventory").insert({
            variant_id: item.variant_id,
            store_id: toStoreId,
            quantity: item.quantity,
          });
        }

        await supabase.from("stock_movements").insert({
          variant_id: item.variant_id,
          movement: "in" as const,
          quantity: item.quantity,
          store_id: toStoreId,
          created_by: user?.id,
        });
      }

      toast({ title: "Berhasil", description: "Mutasi stok berhasil disimpan" });
      setShowForm(false);
      setItems([]);
      setNotes("");
      setToStoreId("");
      fetchTransfers();
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const viewDetail = async (transfer: TransferRecord) => {
    const { data } = await supabase
      .from("stock_transfer_items")
      .select("product_name, variant_name, quantity")
      .eq("transfer_id", transfer.id);
    setShowDetail({ ...transfer, items: data || [] });
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Mutasi Stok</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #333; padding: 8px; text-align: left; }
        th { background: #f3f3f3; }
        .header { margin-bottom: 16px; }
        .header h2 { margin: 0; }
        .meta { font-size: 14px; color: #555; margin: 4px 0; }
        @media print { body { padding: 0; } }
      </style></head><body>
      ${printRef.current.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="num text-2xl font-semibold text-foreground">Mutasi Stok</h2>
          <p className="text-muted-foreground">Transfer stok antar toko</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" /> Buat Mutasi
        </Button>
      </div>

      {/* Transfer List */}
      <Card>
        <CardHeader><CardTitle>Riwayat Mutasi</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Memuat...</p>
          ) : transfers.length === 0 ? (
            <p className="text-muted-foreground text-sm">Belum ada data mutasi</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Transfer</TableHead>
                  <TableHead>Dari</TableHead>
                  <TableHead>Ke</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-sm">{t.transfer_number}</TableCell>
                    <TableCell>{t.from_store_name}</TableCell>
                    <TableCell>{t.to_store_name}</TableCell>
                    <TableCell>{format(new Date(t.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{t.status === "completed" ? "Selesai" : t.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => viewDetail(t)}>
                        <Eye className="w-4 h-4 mr-1" /> Detail
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Transfer Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" /> Buat Mutasi Stok
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Dari Toko</Label>
              <Input value={currentStore?.name || ""} disabled />
            </div>
            <div>
              <Label>Ke Toko</Label>
              <Select value={toStoreId} onValueChange={setToStoreId}>
                <SelectTrigger><SelectValue placeholder="Pilih toko tujuan" /></SelectTrigger>
                <SelectContent>
                  {otherStores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Catatan</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan opsional..." />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Item Mutasi</Label>
                <Button size="sm" variant="outline" onClick={addItem}>
                  <Plus className="w-4 h-4 mr-1" /> Tambah Item
                </Button>
              </div>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada item. Klik tambah item.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produk / Varian</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <VariantPicker
                            variants={variants}
                            value={item.variant_id}
                            onChange={(v) => updateItem(idx, v)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateQuantity(idx, parseInt(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => removeItem(idx)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan Mutasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail + Print Dialog */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Mutasi</DialogTitle>
          </DialogHeader>

          {showDetail && (
            <>
              <div ref={printRef}>
                <div className="header">
                  <h2 style={{ fontSize: "18px", fontWeight: "bold" }}>Bukti Mutasi Stok</h2>
                  <p className="meta">No: {showDetail.transfer_number}</p>
                  <p className="meta">Tanggal: {format(new Date(showDetail.created_at), "dd/MM/yyyy HH:mm")}</p>
                  <p className="meta">Dari: {showDetail.from_store_name}</p>
                  <p className="meta">Ke: {showDetail.to_store_name}</p>
                  {showDetail.notes && <p className="meta">Catatan: {showDetail.notes}</p>}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "12px" }}>
                  <thead>
                    <tr>
                      <th style={{ border: "1px solid #333", padding: "6px", textAlign: "left", background: "#f3f3f3" }}>No</th>
                      <th style={{ border: "1px solid #333", padding: "6px", textAlign: "left", background: "#f3f3f3" }}>Produk</th>
                      <th style={{ border: "1px solid #333", padding: "6px", textAlign: "left", background: "#f3f3f3" }}>Varian</th>
                      <th style={{ border: "1px solid #333", padding: "6px", textAlign: "center", background: "#f3f3f3" }}>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {showDetail.items?.map((item, i) => (
                      <tr key={i}>
                        <td style={{ border: "1px solid #333", padding: "6px" }}>{i + 1}</td>
                        <td style={{ border: "1px solid #333", padding: "6px" }}>{item.product_name}</td>
                        <td style={{ border: "1px solid #333", padding: "6px" }}>{item.variant_name}</td>
                        <td style={{ border: "1px solid #333", padding: "6px", textAlign: "center" }}>{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDetail(null)}>Tutup</Button>
                <Button onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" /> Cetak
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VariantPicker({
  variants,
  value,
  onChange,
}: {
  variants: any[];
  value: number;
  onChange: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = variants.find((v) => v.id === value);
  const filtered = variants.filter((v) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const label = `${v.products?.name || ""} ${v.name || ""}`.toLowerCase();
    return label.includes(q);
  });

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate">
            {selected ? `${selected.products?.name || "-"} - ${selected.name}` : "Pilih produk"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-w-[90vw]" align="start">
        <div className="p-2 border-b sticky top-0 bg-popover">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Cari produk atau varian..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground px-3 py-4 text-center">Tidak ada hasil</p>
          ) : (
            filtered.map((v: any) => (
              <button
                key={v.id}
                type="button"
                onClick={() => { onChange(v.id); setOpen(false); setSearch(""); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                {v.products?.name || "-"} - {v.name}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

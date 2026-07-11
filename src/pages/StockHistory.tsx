import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet, FileText, Trash2, RefreshCw, Search, ArrowUpCircle, ArrowDownCircle, History } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { STOCK_HISTORY_TYPE_LABEL, StockHistoryType } from "@/lib/stockHistory";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface StockHistoryRow {
  id: number;
  store_id: string;
  product_id: number | null;
  variant_id: number | null;
  product_name: string;
  variant_name: string | null;
  movement_type: StockHistoryType;
  qty_before: number;
  qty_change: number;
  qty_after: number;
  user_id: string | null;
  user_name: string | null;
  notes: string | null;
  created_at: string;
}

const PAGE_SIZE = 25;

const typeBadgeVariant = (t: StockHistoryType) => {
  switch (t) {
    case "sale":
    case "product_reduced":
      return "destructive" as const;
    case "product_added":
    case "initial_stock":
    case "product_return":
      return "default" as const;
    default:
      return "secondary" as const;
  }
};

export default function StockHistory() {
  const { currentStoreId } = useStore();
  const { toast } = useToast();
  const [rows, setRows] = useState<StockHistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [stats, setStats] = useState({ additions: 0, reductions: 0, count: 0 });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildQuery = () => {
    let q = supabase
      .from("stock_history" as any)
      .select("*", { count: "exact" })
      .eq("store_id", currentStoreId!)
      .order("created_at", { ascending: false });

    if (search.trim()) {
      const s = `%${search.trim()}%`;
      q = q.or(`product_name.ilike.${s},variant_name.ilike.${s}`);
    }
    if (dateFrom) q = q.gte("created_at", new Date(dateFrom).toISOString());
    if (dateTo) {
      const d = new Date(dateTo);
      d.setHours(23, 59, 59, 999);
      q = q.lte("created_at", d.toISOString());
    }
    if (typeFilter !== "all") q = q.eq("movement_type", typeFilter);
    if (userFilter !== "all") q = q.eq("user_id", userFilter);
    return q;
  };

  const fetchData = async () => {
    if (!currentStoreId) return;
    setLoading(true);
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count, error } = await buildQuery().range(from, to);
      if (error) throw error;
      setRows((data || []) as unknown as StockHistoryRow[]);
      setTotal(count || 0);
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message || "Gagal memuat riwayat", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!currentStoreId) return;
    // Aggregate across current filters (not page-limited)
    let q = supabase
      .from("stock_history" as any)
      .select("qty_change")
      .eq("store_id", currentStoreId);
    if (search.trim()) {
      const s = `%${search.trim()}%`;
      q = q.or(`product_name.ilike.${s},variant_name.ilike.${s}`);
    }
    if (dateFrom) q = q.gte("created_at", new Date(dateFrom).toISOString());
    if (dateTo) {
      const d = new Date(dateTo);
      d.setHours(23, 59, 59, 999);
      q = q.lte("created_at", d.toISOString());
    }
    if (typeFilter !== "all") q = q.eq("movement_type", typeFilter);
    if (userFilter !== "all") q = q.eq("user_id", userFilter);
    const { data, error } = await q.limit(100000);
    if (error) return;
    let additions = 0;
    let reductions = 0;
    (data || []).forEach((r: any) => {
      if (r.qty_change > 0) additions += r.qty_change;
      else if (r.qty_change < 0) reductions += -r.qty_change;
    });
    setStats({ additions, reductions, count: (data || []).length });
  };

  const fetchUsers = async () => {
    if (!currentStoreId) return;
    const { data: members } = await supabase
      .from("store_members")
      .select("user_id")
      .eq("store_id", currentStoreId);
    const ids = (members || []).map((m) => m.user_id);
    if (!ids.length) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", ids);
    setUsers(
      (data || []).map((u: any) => ({
        id: u.id,
        name: u.name || u.email || "Pengguna",
      }))
    );
  };

  useEffect(() => {
    fetchUsers();
  }, [currentStoreId]);

  useEffect(() => {
    fetchData();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoreId, page, search, dateFrom, dateTo, typeFilter, userFilter]);

  const resetFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setTypeFilter("all");
    setUserFilter("all");
    setPage(1);
  };

  const fetchAllForExport = async () => {
    const { data, error } = await buildQuery().range(0, 9999);
    if (error) throw error;
    return (data || []) as unknown as StockHistoryRow[];
  };

  const exportExcel = async () => {
    try {
      const all = await fetchAllForExport();
      const sheetData = all.map((r) => ({
        Tanggal: format(new Date(r.created_at), "dd MMM yyyy HH:mm", { locale: idLocale }),
        Produk: r.product_name,
        Varian: r.variant_name || "-",
        Jenis: STOCK_HISTORY_TYPE_LABEL[r.movement_type],
        "Qty Sebelum": r.qty_before,
        "Qty Perubahan": r.qty_change,
        "Qty Sesudah": r.qty_after,
        Pengguna: r.user_name || "-",
        Catatan: r.notes || "-",
      }));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, "Riwayat Stok");
      XLSX.writeFile(wb, `riwayat_stok_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
    } catch (e: any) {
      toast({ title: "Gagal ekspor", description: e.message, variant: "destructive" });
    }
  };

  const exportPdf = async () => {
    try {
      const all = await fetchAllForExport();
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(14);
      doc.text("Riwayat Stok", 14, 15);
      doc.setFontSize(9);
      doc.text(`Dicetak: ${format(new Date(), "dd MMM yyyy HH:mm", { locale: idLocale })}`, 14, 21);
      autoTable(doc, {
        startY: 26,
        head: [["Tanggal", "Produk", "Varian", "Jenis", "Sebelum", "Perubahan", "Sesudah", "Pengguna", "Catatan"]],
        body: all.map((r) => [
          format(new Date(r.created_at), "dd/MM/yy HH:mm"),
          r.product_name,
          r.variant_name || "-",
          STOCK_HISTORY_TYPE_LABEL[r.movement_type],
          r.qty_before,
          r.qty_change > 0 ? `+${r.qty_change}` : `${r.qty_change}`,
          r.qty_after,
          r.user_name || "-",
          r.notes || "-",
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [30, 41, 59] },
      });
      doc.save(`riwayat_stok_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
    } catch (e: any) {
      toast({ title: "Gagal ekspor PDF", description: e.message, variant: "destructive" });
    }
  };

  const deleteRow = async (id: number) => {
    const { error } = await supabase.from("stock_history" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Gagal hapus", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Berhasil", description: "Data dihapus" });
    fetchData();
    fetchStats();
  };

  const filteredEmpty = useMemo(() => rows.length === 0 && !loading, [rows, loading]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="w-6 h-6" /> Riwayat Stok
          </h1>
          <p className="text-sm text-muted-foreground">Semua pergerakan stok tercatat otomatis dan permanen.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => { fetchData(); fetchStats(); }}>
            <RefreshCw className="w-4 h-4 mr-2" /> Muat Ulang
          </Button>
          <Button variant="outline" onClick={exportExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" onClick={exportPdf}>
            <FileText className="w-4 h-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4 text-green-600" /> Total Penambahan
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">+{stats.additions.toLocaleString("id-ID")}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <ArrowDownCircle className="w-4 h-4 text-red-600" /> Total Pengurangan
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-600">-{stats.reductions.toLocaleString("id-ID")}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Jumlah Pergerakan</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.count.toLocaleString("id-ID")}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filter & Pencarian</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2">
              <Label>Cari produk / varian</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} className="pl-8" placeholder="Nama produk atau varian" />
              </div>
            </div>
            <div>
              <Label>Dari</Label>
              <Input type="date" value={dateFrom} onChange={(e) => { setPage(1); setDateFrom(e.target.value); }} />
            </div>
            <div>
              <Label>Sampai</Label>
              <Input type="date" value={dateTo} onChange={(e) => { setPage(1); setDateTo(e.target.value); }} />
            </div>
            <div>
              <Label>Jenis</Label>
              <Select value={typeFilter} onValueChange={(v) => { setPage(1); setTypeFilter(v); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  {(Object.keys(STOCK_HISTORY_TYPE_LABEL) as StockHistoryType[]).map((t) => (
                    <SelectItem key={t} value={t}>{STOCK_HISTORY_TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pengguna</Label>
              <Select value={userFilter} onValueChange={(v) => { setPage(1); setUserFilter(v); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3">
            <Button variant="ghost" size="sm" onClick={resetFilters}>Reset filter</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Produk</TableHead>
                  <TableHead>Varian</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead className="text-right">Sebelum</TableHead>
                  <TableHead className="text-right">Perubahan</TableHead>
                  <TableHead className="text-right">Sesudah</TableHead>
                  <TableHead>Pengguna</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">Memuat...</TableCell></TableRow>
                )}
                {filteredEmpty && (
                  <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">Tidak ada data</TableCell></TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(r.created_at), "dd MMM yyyy HH:mm", { locale: idLocale })}
                    </TableCell>
                    <TableCell className="font-medium">{r.product_name}</TableCell>
                    <TableCell>{r.variant_name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={typeBadgeVariant(r.movement_type)}>
                        {STOCK_HISTORY_TYPE_LABEL[r.movement_type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.qty_before}</TableCell>
                    <TableCell className={`text-right font-semibold ${r.qty_change > 0 ? "text-green-600" : r.qty_change < 0 ? "text-red-600" : ""}`}>
                      {r.qty_change > 0 ? `+${r.qty_change}` : r.qty_change}
                    </TableCell>
                    <TableCell className="text-right">{r.qty_after}</TableCell>
                    <TableCell>{r.user_name || "-"}</TableCell>
                    <TableCell className="max-w-xs truncate" title={r.notes || ""}>{r.notes || "-"}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus catatan ini?</AlertDialogTitle>
                            <AlertDialogDescription>Catatan riwayat akan dihapus permanen. Stok tidak berubah.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteRow(r.id)}>Hapus</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between p-3 border-t">
            <p className="text-sm text-muted-foreground">
              Menampilkan {rows.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{(page - 1) * PAGE_SIZE + rows.length} dari {total}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</Button>
              <span className="text-sm py-1">Hal. {page} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Berikutnya</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/contexts/StoreContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Coins, Plus, Trash2, TrendingUp, Calendar } from "lucide-react";

interface OtherSale {
  id: string;
  amount: number;
  description: string;
  sale_date: string;
  user_id: string;
  created_at: string;
  user_name?: string;
}

const formatRupiah = (n: number) =>
  "Rp " + Math.round(n).toLocaleString("id-ID");

const formatPriceInput = (v: string) => {
  const digits = v.replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("id-ID");
};

const parsePriceInput = (v: string) => {
  const digits = v.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
};

export default function OtherSales() {
  const { user } = useAuth();
  const { currentStore, userStoreRole } = useStore();
  const { toast } = useToast();
  const isOwner = userStoreRole === "owner";

  const [items, setItems] = useState<OtherSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAll, setTotalAll] = useState(0);
  const [totalToday, setTotalToday] = useState(0);

  const [open, setOpen] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [dateInput, setDateInput] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    if (!currentStore?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("other_sales")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("sale_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = Array.from(
        new Set((data || []).map((d: any) => d.user_id).filter(Boolean))
      );
      let nameMap: Record<string, string> = {};
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", userIds);
        (profiles || []).forEach((p: any) => {
          nameMap[p.id] = p.name || p.email || "Pengguna";
        });
      }

      const enriched: OtherSale[] = (data || []).map((d: any) => ({
        ...d,
        user_name: nameMap[d.user_id] || "Pengguna",
      }));
      setItems(enriched);
      setTotalAll(enriched.reduce((s, d) => s + Number(d.amount), 0));

      const today = new Date().toISOString().split("T")[0];
      setTotalToday(
        enriched
          .filter((d) => d.sale_date === today)
          .reduce((s, d) => s + Number(d.amount), 0)
      );
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Gagal",
        description: "Gagal memuat data penjualan lain-lain",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore?.id]);

  const handleSubmit = async () => {
    const amount = parsePriceInput(amountInput);
    if (!amount || amount <= 0) {
      toast({
        title: "Gagal",
        description: "Nominal harus lebih dari 0",
        variant: "destructive",
      });
      return;
    }
    if (!descInput.trim()) {
      toast({
        title: "Gagal",
        description: "Keterangan wajib diisi",
        variant: "destructive",
      });
      return;
    }
    if (!currentStore?.id || !user?.id) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("other_sales").insert({
        store_id: currentStore.id,
        user_id: user.id,
        amount,
        description: descInput.trim(),
        sale_date: dateInput,
      });
      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Penjualan lain-lain berhasil dicatat",
      });
      setOpen(false);
      setAmountInput("");
      setDescInput("");
      setDateInput(new Date().toISOString().split("T")[0]);
      loadData();
    } catch (err: any) {
      toast({
        title: "Gagal",
        description: err.message || "Gagal menyimpan data",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus catatan penjualan ini?")) return;
    try {
      const { error } = await supabase
        .from("other_sales")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Berhasil", description: "Catatan dihapus" });
      loadData();
    } catch (err: any) {
      toast({
        title: "Gagal",
        description: err.message || "Gagal menghapus",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Coins className="w-7 h-7 text-primary" /> Penjualan Lain-lain
          </h1>
          <p className="text-sm text-muted-foreground">
            Catat pemasukan penjualan di luar transaksi produk (tidak mempengaruhi keuntungan)
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Tambah Penjualan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Penjualan Lain-lain</DialogTitle>
              <DialogDescription>
                Masukkan keterangan dan nominal yang diterima.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tanggal</Label>
                <Input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                />
              </div>
              <div>
                <Label>Keterangan *</Label>
                <Input
                  placeholder="Contoh: Jasa bungkus kado, titip jual..."
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                />
              </div>
              <div>
                <Label>Nominal Diterima (Rp) *</Label>
                <CurrencyKeypadInput
                  value={amountInput}
                  onChange={setAmountInput}
                  label="Nominal Diterima"
                  placeholder="0"
                />

              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Hari Ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(totalToday)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Total Keseluruhan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatRupiah(totalAll)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Penjualan Lain-lain</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Memuat...</p>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Belum ada catatan penjualan lain-lain
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Dicatat Oleh</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                    {isOwner && <TableHead className="text-right">Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(d.sale_date).toLocaleDateString("id-ID", {
                          dateStyle: "medium",
                        })}
                      </TableCell>
                      <TableCell>{d.user_name}</TableCell>
                      <TableCell>{d.description}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatRupiah(Number(d.amount))}
                      </TableCell>
                      {isOwner && (
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(d.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

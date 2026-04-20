import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/contexts/StoreContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Wallet, Plus, CheckCircle2, XCircle, Clock, Banknote, TrendingDown, ShoppingBag } from "lucide-react";

interface CashDeposit {
  id: string;
  amount: number;
  deposit_date: string;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_by: string | null;
  submitted_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  submitter_name?: string;
  approver_name?: string;
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

export default function CashDeposits() {
  const { user } = useAuth();
  const { currentStore, userStoreRole } = useStore();
  const { toast } = useToast();
  const isOwner = userStoreRole === "owner";

  const [deposits, setDeposits] = useState<CashDeposit[]>([]);
  const [totalCashSales, setTotalCashSales] = useState(0);
  const [totalApproved, setTotalApproved] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [todayCashSales, setTodayCashSales] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [loading, setLoading] = useState(true);

  // Submit dialog
  const [submitOpen, setSubmitOpen] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<CashDeposit | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadData = async () => {
    if (!currentStore?.id) return;
    setLoading(true);

    try {
      // Load deposits
      const { data: depositsData, error: depErr } = await supabase
        .from("cash_deposits")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("submitted_at", { ascending: false });

      if (depErr) throw depErr;

      // Get profile names
      const userIds = new Set<string>();
      (depositsData || []).forEach((d: any) => {
        if (d.submitted_by) userIds.add(d.submitted_by);
        if (d.approved_by) userIds.add(d.approved_by);
      });

      let profilesMap: Record<string, string> = {};
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", Array.from(userIds));
        (profiles || []).forEach((p: any) => {
          profilesMap[p.id] = p.name || p.email || "Pengguna";
        });
      }

      const enriched: CashDeposit[] = (depositsData || []).map((d: any) => ({
        ...d,
        submitter_name: d.submitted_by ? profilesMap[d.submitted_by] || "Pengguna" : "-",
        approver_name: d.approved_by ? profilesMap[d.approved_by] || "Pengguna" : undefined,
      }));

      setDeposits(enriched);

      // Compute totals
      const approved = enriched
        .filter((d) => d.status === "approved")
        .reduce((s, d) => s + Number(d.amount), 0);
      const pending = enriched
        .filter((d) => d.status === "pending")
        .reduce((s, d) => s + Number(d.amount), 0);
      setTotalApproved(approved);
      setTotalPending(pending);

      // Load all cash sales for the store
      const { data: salesData, error: salesErr } = await supabase
        .from("sales")
        .select("total, payment_method, created_at, status")
        .eq("store_id", currentStore.id)
        .eq("payment_method", "cash")
        .neq("status", "returned");

      if (salesErr) throw salesErr;

      const totalSales = (salesData || []).reduce(
        (s: number, r: any) => s + Number(r.total || 0),
        0
      );
      setTotalCashSales(totalSales);

      // Today's cash sales
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todaySales = (salesData || [])
        .filter((s: any) => new Date(s.created_at) >= today)
        .reduce((s: number, r: any) => s + Number(r.total || 0), 0);
      setTodayCashSales(todaySales);

      // Load approved store expenses (Belanja Toko) - reduce from undeposited cash
      const { data: expensesData } = await supabase
        .from("store_expenses")
        .select("amount")
        .eq("store_id", currentStore.id)
        .eq("status", "approved");
      const expensesSum = (expensesData || []).reduce(
        (s: number, r: any) => s + Number(r.amount || 0),
        0
      );
      setTotalExpenses(expensesSum);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Gagal",
        description: "Gagal memuat data setoran",
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
    if (!currentStore?.id || !user?.id) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("cash_deposits").insert({
        store_id: currentStore.id,
        amount,
        notes: notesInput || null,
        submitted_by: user.id,
        status: "pending",
      });
      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Pengajuan setoran terkirim, menunggu persetujuan pemilik",
      });
      setSubmitOpen(false);
      setAmountInput("");
      setNotesInput("");
      loadData();
    } catch (err: any) {
      toast({
        title: "Gagal",
        description: err.message || "Gagal mengajukan setoran",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (deposit: CashDeposit) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from("cash_deposits")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", deposit.id);
      if (error) throw error;
      toast({ title: "Berhasil", description: "Setoran disetujui" });
      loadData();
    } catch (err: any) {
      toast({
        title: "Gagal",
        description: err.message || "Gagal menyetujui setoran",
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    if (!user?.id || !rejectTarget) return;
    try {
      const { error } = await supabase
        .from("cash_deposits")
        .update({
          status: "rejected",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectReason || null,
        })
        .eq("id", rejectTarget.id);
      if (error) throw error;
      toast({ title: "Berhasil", description: "Setoran ditolak" });
      setRejectOpen(false);
      setRejectTarget(null);
      setRejectReason("");
      loadData();
    } catch (err: any) {
      toast({
        title: "Gagal",
        description: err.message || "Gagal menolak setoran",
        variant: "destructive",
      });
    }
  };

  const undeposited = totalCashSales - totalApproved - totalExpenses;

  const statusBadge = (status: string) => {
    if (status === "approved")
      return (
        <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/20 border-green-500/30">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Disetujui
        </Badge>
      );
    if (status === "rejected")
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" /> Ditolak
        </Badge>
      );
    return (
      <Badge className="bg-yellow-500/15 text-yellow-700 hover:bg-yellow-500/20 border-yellow-500/30">
        <Clock className="w-3 h-3 mr-1" /> Menunggu
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-7 h-7 text-primary" /> Setoran Kas
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola setoran uang tunai dari penjualan harian
          </p>
        </div>

        <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Ajukan Setoran
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajukan Setoran Uang</DialogTitle>
              <DialogDescription>
                Masukkan nominal uang tunai yang akan disetorkan kepada pemilik.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nominal Setoran (Rp)</Label>
                <Input
                  inputMode="numeric"
                  placeholder="0"
                  value={amountInput}
                  onChange={(e) => setAmountInput(formatPriceInput(e.target.value))}
                />
              </div>
              <div>
                <Label>Catatan (opsional)</Label>
                <Textarea
                  placeholder="Catatan setoran..."
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                />
              </div>
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                Saldo kas belum disetor saat ini:{" "}
                <span className="font-semibold text-foreground">
                  {formatRupiah(undeposited)}
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSubmitOpen(false)}>
                Batal
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Mengirim..." : "Kirim Pengajuan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Banknote className="w-4 h-4" /> Penjualan Tunai Hari Ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(todayCashSales)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Banknote className="w-4 h-4" /> Total Penjualan Tunai
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(totalCashSales)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Sudah Disetor (Disetujui)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatRupiah(totalApproved)}
            </div>
            {totalPending > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                + {formatRupiah(totalPending)} menunggu persetujuan
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4" /> Belum Disetor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatRupiah(undeposited)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deposits table */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Pengajuan Setoran</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Memuat...</p>
          ) : deposits.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Belum ada pengajuan setoran
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Diajukan Oleh</TableHead>
                    <TableHead>Nominal</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Disetujui Oleh</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deposits.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(d.submitted_at).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell>{d.submitter_name}</TableCell>
                      <TableCell className="font-semibold">
                        {formatRupiah(Number(d.amount))}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {d.notes || "-"}
                      </TableCell>
                      <TableCell>
                        {statusBadge(d.status)}
                        {d.status === "rejected" && d.rejection_reason && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Alasan: {d.rejection_reason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {d.approver_name || "-"}
                        {d.approved_at && (
                          <p className="text-xs">
                            {new Date(d.approved_at).toLocaleString("id-ID", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isOwner && d.status === "pending" ? (
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApprove(d)}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" /> ACC
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setRejectTarget(d);
                                setRejectOpen(true);
                              }}
                            >
                              <XCircle className="w-4 h-4 mr-1" /> Tolak
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Pengajuan Setoran</DialogTitle>
            <DialogDescription>
              Berikan alasan penolakan untuk setoran sebesar{" "}
              {rejectTarget && formatRupiah(Number(rejectTarget.amount))}.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Alasan Penolakan</Label>
            <Textarea
              placeholder="Misal: nominal tidak sesuai..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Tolak Setoran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

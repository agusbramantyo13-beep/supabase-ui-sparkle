import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/contexts/StoreContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyKeypadInput } from "@/components/CurrencyKeypadInput";
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
import { ShoppingBag, Plus, CheckCircle2, XCircle, Clock, TrendingDown } from "lucide-react";

interface StoreExpense {
  id: string;
  amount: number;
  description: string;
  expense_date: string;
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

export default function StoreExpenses() {
  const { user } = useAuth();
  const { currentStore, userStoreRole } = useStore();
  const { toast } = useToast();
  const isOwner = userStoreRole === "owner";

  const [expenses, setExpenses] = useState<StoreExpense[]>([]);
  const [totalApproved, setTotalApproved] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [todayApproved, setTodayApproved] = useState(0);
  const [loading, setLoading] = useState(true);

  // Submit dialog
  const [submitOpen, setSubmitOpen] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<StoreExpense | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadData = async () => {
    if (!currentStore?.id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("store_expenses")
        .select("*")
        .eq("store_id", currentStore.id)
        .order("submitted_at", { ascending: false });

      if (error) throw error;

      const userIds = new Set<string>();
      (data || []).forEach((d: any) => {
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

      const enriched: StoreExpense[] = (data || []).map((d: any) => ({
        ...d,
        submitter_name: d.submitted_by ? profilesMap[d.submitted_by] || "Pengguna" : "-",
        approver_name: d.approved_by ? profilesMap[d.approved_by] || "Pengguna" : undefined,
      }));

      setExpenses(enriched);

      const approved = enriched.filter((d) => d.status === "approved");
      const pending = enriched.filter((d) => d.status === "pending");
      setTotalApproved(approved.reduce((s, d) => s + Number(d.amount), 0));
      setTotalPending(pending.reduce((s, d) => s + Number(d.amount), 0));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setTodayApproved(
        approved
          .filter((d) => new Date(d.approved_at || d.submitted_at) >= today)
          .reduce((s, d) => s + Number(d.amount), 0)
      );
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Gagal",
        description: "Gagal memuat data belanja",
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
        description: "Keterangan belanja wajib diisi",
        variant: "destructive",
      });
      return;
    }
    if (!currentStore?.id || !user?.id) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("store_expenses").insert({
        store_id: currentStore.id,
        amount,
        description: descInput.trim(),
        notes: notesInput || null,
        submitted_by: user.id,
        status: "pending",
      });
      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Pengajuan belanja terkirim, menunggu persetujuan pemilik",
      });
      setSubmitOpen(false);
      setAmountInput("");
      setDescInput("");
      setNotesInput("");
      loadData();
    } catch (err: any) {
      toast({
        title: "Gagal",
        description: err.message || "Gagal mengajukan belanja",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (expense: StoreExpense) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from("store_expenses")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", expense.id);
      if (error) throw error;
      toast({ title: "Berhasil", description: "Belanja disetujui" });
      loadData();
    } catch (err: any) {
      toast({
        title: "Gagal",
        description: err.message || "Gagal menyetujui belanja",
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    if (!user?.id || !rejectTarget) return;
    try {
      const { error } = await supabase
        .from("store_expenses")
        .update({
          status: "rejected",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectReason || null,
        })
        .eq("id", rejectTarget.id);
      if (error) throw error;
      toast({ title: "Berhasil", description: "Belanja ditolak" });
      setRejectOpen(false);
      setRejectTarget(null);
      setRejectReason("");
      loadData();
    } catch (err: any) {
      toast({
        title: "Gagal",
        description: err.message || "Gagal menolak belanja",
        variant: "destructive",
      });
    }
  };

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
          <h1 className="num text-2xl font-semibold flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-primary" /> Belanja Toko
          </h1>
          <p className="text-sm text-muted-foreground">
            Pengajuan belanja kebutuhan toko menggunakan kas
          </p>
        </div>

        <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Ajukan Belanja
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajukan Belanja Toko</DialogTitle>
              <DialogDescription>
                Masukkan nominal dan keterangan belanja kebutuhan toko.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nominal Belanja (Rp)</Label>
                <CurrencyKeypadInput
                  value={amountInput}
                  onChange={setAmountInput}
                  label="Nominal Belanja"
                  placeholder="0"
                />

              </div>
              <div>
                <Label>Keterangan Belanja *</Label>
                <Input
                  placeholder="Contoh: Beli plastik kemasan, tinta printer..."
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                />
              </div>
              <div>
                <Label>Catatan Tambahan (opsional)</Label>
                <Textarea
                  placeholder="Catatan tambahan..."
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                />
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4" /> Belanja Hari Ini (Disetujui)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="num text-2xl font-semibold">{formatRupiah(todayApproved)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Total Belanja Disetujui
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="num text-2xl font-semibold text-destructive">
              {formatRupiah(totalApproved)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" /> Menunggu Persetujuan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="num text-2xl font-semibold text-yellow-600">
              {formatRupiah(totalPending)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expenses table */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Pengajuan Belanja</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Memuat...</p>
          ) : expenses.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Belum ada pengajuan belanja
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Diajukan Oleh</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead>Nominal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Disetujui Oleh</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(d.submitted_at).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell>{d.submitter_name}</TableCell>
                      <TableCell className="max-w-[260px]">
                        <p className="font-medium text-foreground">{d.description}</p>
                        {d.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {d.notes}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-destructive">
                        - {formatRupiah(Number(d.amount))}
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
            <DialogTitle>Tolak Pengajuan Belanja</DialogTitle>
            <DialogDescription>
              Berikan alasan penolakan (opsional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Alasan penolakan..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Tolak Pengajuan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

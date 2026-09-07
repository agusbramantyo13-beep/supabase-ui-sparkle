import { useEffect, useMemo, useState } from "react";
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
  PeriodFilter,
  PeriodPreset,
  resolvePeriod,
  formatPeriodLabel,
} from "@/components/PeriodFilter";
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
import { ShoppingBag, Plus, CheckCircle2, XCircle, Clock, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react";

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

interface Summary {
  total_approved: number;
  total_pending: number;
  today_approved: number;
}

const EMPTY_SUMMARY: Summary = {
  total_approved: 0,
  total_pending: 0,
  today_approved: 0,
};

const PAGE_SIZE = 20;

const formatRupiah = (n: number) =>
  "Rp " + Math.round(n).toLocaleString("id-ID");

const parsePriceInput = (v: string) => {
  const digits = v.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
};

export default function StoreExpenses() {
  const { user } = useAuth();
  const { currentStore, userStoreRole } = useStore();
  const { toast } = useToast();
  const isOwner = userStoreRole === "owner";

  // Period filter
  const [preset, setPreset] = useState<PeriodPreset>("this_month");
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);
  const range = useMemo(
    () => resolvePeriod(preset, customStart, customEnd),
    [preset, customStart, customEnd]
  );
  const periodLabel = formatPeriodLabel(preset, range);
  const startIso = range.start ? range.start.toISOString() : null;
  const endIso = range.end ? range.end.toISOString() : null;

  const [expenses, setExpenses] = useState<StoreExpense[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(0);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
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

  const loadSummary = async () => {
    if (!currentStore?.id) return;
    const { data, error } = await supabase.rpc("get_store_expenses_summary", {
      p_store_id: currentStore.id,
      p_start: startIso,
      p_end: endIso,
    });
    if (error) throw error;
    const row = (data as any[])?.[0];
    setSummary(
      row
        ? {
            total_approved: Number(row.total_approved || 0),
            total_pending: Number(row.total_pending || 0),
            today_approved: Number(row.today_approved || 0),
          }
        : EMPTY_SUMMARY
    );
  };

  const loadExpenses = async () => {
    if (!currentStore?.id) return;
    let q = supabase
      .from("store_expenses")
      .select("*", { count: "exact" })
      .eq("store_id", currentStore.id);
    if (startIso) q = q.gte("submitted_at", startIso);
    if (endIso) q = q.lt("submitted_at", endIso);

    const { data, error, count } = await q
      .order("submitted_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw error;

    setTotalRows(count || 0);

    const rows = data || [];
    const userIds = new Set<string>();
    rows.forEach((d: any) => {
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

    setExpenses(
      rows.map((d: any) => ({
        ...d,
        submitter_name: d.submitted_by ? profilesMap[d.submitted_by] || "Pengguna" : "-",
        approver_name: d.approved_by ? profilesMap[d.approved_by] || "Pengguna" : undefined,
      }))
    );
  };

  const loadData = async () => {
    if (!currentStore?.id) return;
    setLoading(true);
    try {
      await Promise.all([loadSummary(), loadExpenses()]);
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

  // Reset pagination whenever the period changes
  useEffect(() => {
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customStart, customEnd, currentStore?.id]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore?.id, startIso, endIso, page]);

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

  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

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

      {/* Period filter */}
      <Card>
        <CardContent className="pt-4">
          <PeriodFilter
            preset={preset}
            onPresetChange={setPreset}
            customStart={customStart}
            customEnd={customEnd}
            onCustomChange={(s, e) => {
              setCustomStart(s);
              setCustomEnd(e);
            }}
          />
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4" /> Belanja Hari Ini (Disetujui)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="num text-2xl font-semibold">{formatRupiah(summary.today_approved)}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Selalu hari ini, tidak mengikuti filter periode</p>
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
              {formatRupiah(summary.total_approved)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{periodLabel}</p>
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
              {formatRupiah(summary.total_pending)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Semua waktu, tidak mengikuti filter periode</p>
          </CardContent>
        </Card>
      </div>

      {/* Expenses table */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Pengajuan Belanja — {periodLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Memuat...</p>
          ) : expenses.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Belum ada pengajuan belanja pada periode ini
            </p>
          ) : (
            <>
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

              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Menampilkan {page * PAGE_SIZE + 1}–
                  {Math.min((page + 1) * PAGE_SIZE, totalRows)} dari {totalRows}{" "}
                  pengajuan
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm num">
                    {page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
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

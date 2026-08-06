import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/contexts/StoreContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Wallet,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Banknote,
  TrendingDown,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

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

interface Summary {
  total_cash_sales: number;
  total_other_sales: number;
  total_approved_deposits: number;
  total_pending_deposits: number;
  total_approved_expenses: number;
  today_cash: number;
}

const EMPTY_SUMMARY: Summary = {
  total_cash_sales: 0,
  total_other_sales: 0,
  total_approved_deposits: 0,
  total_pending_deposits: 0,
  total_approved_expenses: 0,
  today_cash: 0,
};

const PAGE_SIZE = 20;

const formatRupiah = (n: number) =>
  "Rp " + Math.round(n).toLocaleString("id-ID");

const parsePriceInput = (v: string) => {
  const digits = v.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
};

export default function CashDeposits() {
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

  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [allTimeSummary, setAllTimeSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [deposits, setDeposits] = useState<CashDeposit[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(0);
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

  const startIso = range.start ? range.start.toISOString() : null;
  const endIso = range.end ? range.end.toISOString() : null;

  const loadSummary = async () => {
    if (!currentStore?.id) return;
    const { data, error } = await supabase.rpc("get_cash_deposit_summary", {
      p_store_id: currentStore.id,
      p_start: startIso,
      p_end: endIso,
    });
    if (error) throw error;
    const row = (data as unknown as Summary[])?.[0];
    setSummary(
      row
        ? {
            total_cash_sales: Number(row.total_cash_sales || 0),
            total_other_sales: Number(row.total_other_sales || 0),
            total_approved_deposits: Number(row.total_approved_deposits || 0),
            total_pending_deposits: Number(row.total_pending_deposits || 0),
            total_approved_expenses: Number(row.total_approved_expenses || 0),
            today_cash: Number(row.today_cash || 0),
          }
        : EMPTY_SUMMARY
    );
  };

  // All-time summary (ignores the period filter) — powers "Belum Disetor"
  const loadAllTimeSummary = async () => {
    if (!currentStore?.id) return;
    const { data, error } = await supabase.rpc("get_cash_deposit_summary", {
      p_store_id: currentStore.id,
      p_start: null,
      p_end: null,
    });
    if (error) throw error;
    const row = (data as unknown as Summary[])?.[0];
    setAllTimeSummary(
      row
        ? {
            total_cash_sales: Number(row.total_cash_sales || 0),
            total_other_sales: Number(row.total_other_sales || 0),
            total_approved_deposits: Number(row.total_approved_deposits || 0),
            total_pending_deposits: Number(row.total_pending_deposits || 0),
            total_approved_expenses: Number(row.total_approved_expenses || 0),
            today_cash: Number(row.today_cash || 0),
          }
        : EMPTY_SUMMARY
    );
  };

  const loadDeposits = async () => {
    if (!currentStore?.id) return;
    let q = supabase
      .from("cash_deposits")
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

    const profilesMap: Record<string, string> = {};
    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", Array.from(userIds));
      (profiles || []).forEach((p: any) => {
        profilesMap[p.id] = p.name || p.email || "Pengguna";
      });
    }

    setDeposits(
      rows.map((d: any) => ({
        ...d,
        submitter_name: d.submitted_by
          ? profilesMap[d.submitted_by] || "Pengguna"
          : "-",
        approver_name: d.approved_by
          ? profilesMap[d.approved_by] || "Pengguna"
          : undefined,
      }))
    );
  };

  const loadData = async (includeAllTime = false) => {
    if (!currentStore?.id) return;
    setLoading(true);
    try {
      await Promise.all([
        loadSummary(),
        loadDeposits(),
        ...(includeAllTime ? [loadAllTimeSummary()] : []),
      ]);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Gagal",
        description: err?.message || "Gagal memuat data setoran",
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

  // All-time balance: fetched once per store, refreshed only after mutations
  useEffect(() => {
    loadAllTimeSummary().catch((e) => console.error(e));
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

  const totalCashSales = summary.total_cash_sales + summary.total_other_sales;
  const undeposited =
    totalCashSales -
    summary.total_approved_deposits -
    summary.total_approved_expenses;

  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

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
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" /> Setoran Kas
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola setoran uang tunai dari penjualan
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
                <CurrencyKeypadInput
                  value={amountInput}
                  onChange={setAmountInput}
                  label="Nominal Setoran"
                  placeholder="0"
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
                Saldo kas belum disetor ({periodLabel}):{" "}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Banknote className="w-4 h-4" /> Kas Fisik Hari Ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="num text-2xl font-semibold">
              {formatRupiah(summary.today_cash)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              Selalu hari ini. Termasuk penjualan tunai, bagian tunai dari split
              payment, dan penjualan lain-lain.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Banknote className="w-4 h-4" /> Total Penjualan Tunai
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="num text-2xl font-semibold">
              {formatRupiah(totalCashSales)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{periodLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Sudah Disetor (Disetujui)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="num text-2xl font-semibold text-green-600">
              {formatRupiah(summary.total_approved_deposits)}
            </div>
            {summary.total_pending_deposits > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                + {formatRupiah(summary.total_pending_deposits)} menunggu
                persetujuan
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
            <div className="num text-2xl font-semibold text-primary">
              {formatRupiah(undeposited)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{periodLabel}</p>
            {summary.total_approved_expenses > 0 && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <ShoppingBag className="w-3 h-3" /> Belanja toko: -
                {formatRupiah(summary.total_approved_expenses)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deposits table */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Pengajuan Setoran — {periodLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Memuat...</p>
          ) : deposits.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Belum ada pengajuan setoran pada periode ini
            </p>
          ) : (
            <>
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
                        <TableCell className="num font-semibold">
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

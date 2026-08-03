import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  CalendarIcon, DollarSign, TrendingUp, TrendingDown, Percent, ShoppingCart,
  Calendar as CalendarIco, FileSpreadsheet, FileText, AlertTriangle, ChevronLeft, ChevronRight, ArrowUpDown,
} from "lucide-react";
import { format, startOfWeek, startOfMonth, endOfToday, startOfToday } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ---------- helpers ----------
const fmtIDR = (n: number | null | undefined) =>
  "Rp " + Number(n ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });
const fmtPct = (n: number | null | undefined) => `${Number(n ?? 0).toFixed(1)}%`;
const toDateStr = (d: Date) => format(d, "yyyy-MM-dd");
const parseDateStr = (s: string) => new Date(s + "T00:00:00");

// Type helper to bypass expensive supabase-js select-string parsing
const sel = (s: string): string => s;

type SummaryRow = {
  total_revenue: number; total_cost: number; total_profit: number;
  total_transactions: number; avg_margin_pct: number;
};
type PeriodRow = {
  period_start: string; revenue: number; cost: number; profit: number;
  transactions: number; margin_pct: number;
};
type CategoryRow = {
  category_id: number | null; category_name: string | null;
  revenue: number; cost: number; profit: number; margin_pct: number; quantity_sold: number;
};
type CashierRow = {
  cashier_id: string | null; cashier_name: string | null;
  revenue: number; cost: number; profit: number; margin_pct: number; total_transactions: number;
};
type TopProductRow = {
  product_id: number | null; variant_id: number | null;
  product_name: string | null; variant_name: string | null;
  quantity_sold: number; revenue: number; cost: number; profit: number; margin_pct: number;
};
type DetailRow = {
  sale_id: string; sale_created_at: string; receipt_number: string | null;
  product_id: number | null; product_name: string | null;
  variant_id: number | null; variant_name: string | null;
  category_id: number | null; category_name: string | null;
  quantity: number; cost_price: number; unit_price: number;
  profit: number; margin_pct: number;
  cashier_id: string | null; cashier_name: string | null;
};

const PAGE_SIZE = 25;
const MAX_EXPORT_ROWS = 50000;

// ---------- date range picker ----------
function DateInput({ value, onChange, label }: { value: Date; onChange: (d: Date) => void; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-start text-left font-normal min-w-[150px]">
            <CalendarIcon className="w-4 h-4 mr-2" />
            {format(value, "dd MMM yyyy", { locale: idLocale })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => d && onChange(d)}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ---------- summary card ----------
function SummaryCard({
  title, value, sub, icon, tone, onClick, loading, highlight,
}: {
  title: string; value: string; sub?: string; icon: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  onClick?: () => void; loading?: boolean; highlight?: boolean;
}) {
  const toneClasses = {
    default: "text-primary", success: "text-success", warning: "text-warning", danger: "text-destructive",
  } as const;
  return (
    <Card
      className={cn(
        "bg-card border-border transition-all",
        onClick && "cursor-pointer hover:shadow-md hover:border-primary/40",
        highlight && "ring-2 ring-primary/40"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
            {loading ? (
              <Skeleton className="h-7 w-32 mt-1" />
            ) : (
              <p className="text-lg sm:num text-2xl font-semibold text-foreground truncate">{value}</p>
            )}
            {sub && <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>}
          </div>
          <div className={cn("shrink-0 ml-2", toneClasses[tone ?? "default"])}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
export default function ProfitDashboard() {
  const { currentStoreId } = useStore();
  const { toast } = useToast();

  // Selected period
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() - 29); return d;
  });
  const [endDate, setEndDate] = useState<Date>(() => new Date());

  // Cards
  const [todaySum, setTodaySum] = useState<SummaryRow | null>(null);
  const [weekSum, setWeekSum] = useState<SummaryRow | null>(null);
  const [monthSum, setMonthSum] = useState<SummaryRow | null>(null);
  const [periodSum, setPeriodSum] = useState<SummaryRow | null>(null);
  const [cardsLoading, setCardsLoading] = useState(false);

  // Chart
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
  const [chartData, setChartData] = useState<PeriodRow[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  // Category / cashier / top products
  const [categoryData, setCategoryData] = useState<CategoryRow[]>([]);
  const [cashierData, setCashierData] = useState<CashierRow[]>([]);
  const [topMetric, setTopMetric] = useState<"most_profitable" | "highest_margin" | "lowest_margin" | "below_cost">("most_profitable");
  const [topData, setTopData] = useState<TopProductRow[]>([]);
  const [otherLoading, setOtherLoading] = useState(false);
  const [topLoading, setTopLoading] = useState(false);

  // Detail table
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "profit_desc" | "profit_asc" | "product_asc">("date_desc");
  const [filterProductId, setFilterProductId] = useState<string>("all");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [filterCashierId, setFilterCashierId] = useState<string>("all");

  // Dropdown options
  const [productOptions, setProductOptions] = useState<{ id: number; name: string }[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<{ id: number; name: string }[]>([]);
  const [cashierOptions, setCashierOptions] = useState<{ id: string; name: string }[]>([]);

  // Drill-down
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillDate, setDrillDate] = useState<{ start: Date; end: Date; label: string } | null>(null);
  const [drillTx, setDrillTx] = useState<{ sale_id: string; receipt_number: string | null; sale_created_at: string; cashier_name: string | null; profit: number }[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const [saleOpen, setSaleOpen] = useState(false);
  const [saleId, setSaleId] = useState<string | null>(null);
  const [saleItems, setSaleItems] = useState<DetailRow[]>([]);
  const [saleLoading, setSaleLoading] = useState(false);

  const [activeCard, setActiveCard] = useState<"today" | "week" | "month" | "period" | null>(null);

  // ---------- date bounds ----------
  const today = useMemo(() => startOfToday(), []);
  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const monthStart = useMemo(() => startOfMonth(new Date()), []);

  // ---------- fetch summary cards ----------
  useEffect(() => {
    if (!currentStoreId) return;
    let cancelled = false;
    (async () => {
      setCardsLoading(true);
      const empty: SummaryRow = { total_revenue: 0, total_cost: 0, total_profit: 0, total_transactions: 0, avg_margin_pct: 0 };
      const call = async (start: Date, end: Date) => {
        const { data, error } = await supabase.rpc("get_profit_summary", {
          p_store_id: currentStoreId, p_start: toDateStr(start), p_end: toDateStr(end),
        });
        if (error) { console.error(error); return empty; }
        return (data?.[0] as SummaryRow) ?? empty;
      };
      const [t, w, m, p] = await Promise.all([
        call(today, today),
        call(weekStart, today),
        call(monthStart, today),
        call(startDate, endDate),
      ]);
      if (cancelled) return;
      setTodaySum(t); setWeekSum(w); setMonthSum(m); setPeriodSum(p);
      setCardsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [currentStoreId, startDate, endDate, today, weekStart, monthStart]);

  // ---------- fetch chart ----------
  useEffect(() => {
    if (!currentStoreId) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      setChartLoading(true);
      const { data, error } = await supabase.rpc("get_profit_by_period", {
        p_store_id: currentStoreId, p_start: toDateStr(startDate), p_end: toDateStr(endDate), p_group_by: groupBy,
      });
      if (cancelled) return;
      if (error) { console.error(error); setChartData([]); }
      else setChartData((data as PeriodRow[]) ?? []);
      setChartLoading(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [currentStoreId, startDate, endDate, groupBy]);

  // ---------- fetch category & cashier ----------
  useEffect(() => {
    if (!currentStoreId) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      setOtherLoading(true);
      const [cat, cash] = await Promise.all([
        supabase.rpc("get_profit_by_category", { p_store_id: currentStoreId, p_start: toDateStr(startDate), p_end: toDateStr(endDate) }),
        supabase.rpc("get_profit_by_cashier", { p_store_id: currentStoreId, p_start: toDateStr(startDate), p_end: toDateStr(endDate) }),
      ]);
      if (cancelled) return;
      if (cat.error) console.error(cat.error);
      if (cash.error) console.error(cash.error);
      setCategoryData((cat.data as CategoryRow[]) ?? []);
      setCashierData((cash.data as CashierRow[]) ?? []);
      setOtherLoading(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [currentStoreId, startDate, endDate]);

  // ---------- fetch top products ----------
  useEffect(() => {
    if (!currentStoreId) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      setTopLoading(true);
      const { data, error } = await supabase.rpc("get_top_products_profit", {
        p_store_id: currentStoreId, p_start: toDateStr(startDate), p_end: toDateStr(endDate),
        p_metric: topMetric, p_limit: 10,
      });
      if (cancelled) return;
      if (error) { console.error(error); setTopData([]); }
      else setTopData((data as TopProductRow[]) ?? []);
      setTopLoading(false);
    }, 200);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [currentStoreId, startDate, endDate, topMetric]);

  // ---------- dropdown options ----------
  useEffect(() => {
    if (!currentStoreId) return;
    (async () => {
      const [prods, cats] = await Promise.all([
        supabase.from("products").select("id, name").eq("store_id", currentStoreId).order("name"),
        supabase.from("categories").select("id, name").eq("store_id", currentStoreId).order("name"),
      ]);
      setProductOptions((prods.data as any[])?.map(p => ({ id: p.id, name: p.name })) ?? []);
      setCategoryOptions((cats.data as any[])?.map(c => ({ id: c.id, name: c.name })) ?? []);

      // cashiers = store members + developers (via profiles join)
      const { data: members } = await supabase
        .from("store_members")
        .select("user_id, profiles!inner(id, name, email)")
        .eq("store_id", currentStoreId);
      const options = (members as any[])?.map((m) => ({
        id: m.profiles.id,
        name: m.profiles.name || m.profiles.email || m.profiles.id.slice(0, 8),
      })) ?? [];
      setCashierOptions(options);
    })();
  }, [currentStoreId]);

  // ---------- fetch detail table ----------
  const buildDetailQuery = useCallback((countMode: boolean) => {
    let q = supabase
      .from("v_sale_item_profit")
      .select(sel("sale_id, sale_created_at, receipt_number, product_id, product_name, variant_id, variant_name, category_id, category_name, quantity, cost_price, unit_price, profit, margin_pct, cashier_id, cashier_name"),
        countMode ? { count: "exact", head: false } : undefined)
      .eq("store_id", currentStoreId as string)
      .gte("sale_created_at", startDate.toISOString())
      .lte("sale_created_at", new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999).toISOString());
    if (filterProductId !== "all") q = q.eq("product_id", Number(filterProductId));
    if (filterCategoryId !== "all") q = q.eq("category_id", Number(filterCategoryId));
    if (filterCashierId !== "all") q = q.eq("cashier_id", filterCashierId);
    return q;
  }, [currentStoreId, startDate, endDate, filterProductId, filterCategoryId, filterCashierId]);

  useEffect(() => {
    if (!currentStoreId) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      setDetailLoading(true);
      let q = buildDetailQuery(true);
      switch (sortBy) {
        case "date_desc": q = q.order("sale_created_at", { ascending: false }); break;
        case "date_asc": q = q.order("sale_created_at", { ascending: true }); break;
        case "profit_desc": q = q.order("profit", { ascending: false, nullsFirst: false }); break;
        case "profit_asc": q = q.order("profit", { ascending: true, nullsFirst: false }); break;
        case "product_asc": q = q.order("product_name", { ascending: true, nullsFirst: false }); break;
      }
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count, error } = await q.range(from, to).returns<DetailRow[]>();
      if (cancelled) return;
      if (error) { console.error(error); setRows([]); setTotalRows(0); }
      else { setRows(data ?? []); setTotalRows(count ?? 0); }
      setDetailLoading(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [buildDetailQuery, sortBy, page]);

  // reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [startDate, endDate, filterProductId, filterCategoryId, filterCashierId, sortBy]);

  // ---------- drill-down: card / chart bar -> transactions of a date range ----------
  const openDrillForRange = async (start: Date, end: Date, label: string) => {
    if (!currentStoreId) return;
    setDrillDate({ start, end, label });
    setDrillOpen(true);
    setDrillLoading(true);
    // fetch a bounded slice (up to 5000 items) and group per sale_id client-side
    const { data, error } = await supabase
      .from("v_sale_item_profit")
      .select(sel("sale_id, receipt_number, sale_created_at, cashier_name, profit"))
      .eq("store_id", currentStoreId)
      .gte("sale_created_at", start.toISOString())
      .lte("sale_created_at", end.toISOString())
      .order("sale_created_at", { ascending: false })
      .limit(5000)
      .returns<{ sale_id: string; receipt_number: string | null; sale_created_at: string; cashier_name: string | null; profit: number }[]>();
    if (error) { console.error(error); setDrillTx([]); setDrillLoading(false); return; }
    const map = new Map<string, { sale_id: string; receipt_number: string | null; sale_created_at: string; cashier_name: string | null; profit: number }>();
    for (const r of data ?? []) {
      const cur = map.get(r.sale_id);
      if (cur) cur.profit += Number(r.profit ?? 0);
      else map.set(r.sale_id, { ...r, profit: Number(r.profit ?? 0) });
    }
    setDrillTx(Array.from(map.values()).sort((a, b) => (a.sale_created_at < b.sale_created_at ? 1 : -1)));
    setDrillLoading(false);
  };

  const openSale = async (sid: string) => {
    setSaleId(sid); setSaleOpen(true); setSaleLoading(true);
    const { data, error } = await supabase
      .from("v_sale_item_profit")
      .select(sel("sale_id, sale_created_at, receipt_number, product_id, product_name, variant_id, variant_name, category_id, category_name, quantity, cost_price, unit_price, profit, margin_pct, cashier_id, cashier_name"))
      .eq("sale_id", sid)
      .returns<DetailRow[]>();
    if (error) { console.error(error); setSaleItems([]); }
    else setSaleItems(data ?? []);
    setSaleLoading(false);
  };

  // ---------- export ----------
  const fetchAllForExport = async (): Promise<DetailRow[]> => {
    // First check total count
    const countQ = buildDetailQuery(true).limit(1);
    const { count } = await countQ;
    if ((count ?? 0) > MAX_EXPORT_ROWS) {
      toast({
        title: "Data terlalu banyak",
        description: `Total ${count?.toLocaleString("id-ID")} baris. Batas export ${MAX_EXPORT_ROWS.toLocaleString("id-ID")} baris. Persempit filter terlebih dulu.`,
        variant: "destructive",
      });
      return [];
    }
    const all: DetailRow[] = [];
    const chunk = 1000;
    for (let from = 0; from < (count ?? 0); from += chunk) {
      let q = buildDetailQuery(false).order("sale_created_at", { ascending: false });
      const { data, error } = await q.range(from, from + chunk - 1).returns<DetailRow[]>();
      if (error) { console.error(error); break; }
      all.push(...(data ?? []));
      if (!data || data.length < chunk) break;
    }
    return all;
  };

  const exportExcel = async () => {
    const data = await fetchAllForExport();
    if (data.length === 0) return;
    const wsData = data.map((r) => ({
      "Tanggal": format(new Date(r.sale_created_at), "yyyy-MM-dd HH:mm", { locale: idLocale }),
      "No. Invoice": r.receipt_number ?? "",
      "Produk": r.product_name ?? "",
      "Varian": r.variant_name ?? "-",
      "Kategori": r.category_name ?? "",
      "Qty": Number(r.quantity),
      "Harga Modal": Number(r.cost_price),
      "Harga Jual": Number(r.unit_price),
      "Profit": Number(r.profit),
      "Margin %": Number(r.margin_pct).toFixed(2),
      "Kasir": r.cashier_name ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Profit Detail");
    XLSX.writeFile(wb, `profit_${toDateStr(startDate)}_${toDateStr(endDate)}.xlsx`);
    toast({ title: "Export berhasil", description: `${data.length} baris diekspor ke Excel.` });
  };

  const exportPDF = async () => {
    const data = await fetchAllForExport();
    if (data.length === 0 && !periodSum) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Laporan Profit", 14, 15);
    doc.setFontSize(10);
    doc.text(`Periode: ${format(startDate, "dd MMM yyyy", { locale: idLocale })} - ${format(endDate, "dd MMM yyyy", { locale: idLocale })}`, 14, 22);
    if (periodSum) {
      autoTable(doc, {
        startY: 28,
        head: [["Total Revenue", "Total Modal", "Total Profit", "Transaksi", "Margin"]],
        body: [[
          fmtIDR(periodSum.total_revenue), fmtIDR(periodSum.total_cost), fmtIDR(periodSum.total_profit),
          String(periodSum.total_transactions), fmtPct(periodSum.avg_margin_pct),
        ]],
        theme: "grid", styles: { fontSize: 9 },
      });
    }
    autoTable(doc, {
      startY: (doc as any).lastAutoTable?.finalY + 6 || 40,
      head: [["Tanggal", "Invoice", "Produk", "Varian", "Qty", "Modal", "Jual", "Profit", "Margin", "Kasir"]],
      body: data.slice(0, 5000).map((r) => [
        format(new Date(r.sale_created_at), "dd/MM/yy HH:mm"),
        r.receipt_number ?? "",
        r.product_name ?? "",
        r.variant_name ?? "-",
        String(r.quantity),
        fmtIDR(r.cost_price),
        fmtIDR(r.unit_price),
        fmtIDR(r.profit),
        fmtPct(r.margin_pct),
        r.cashier_name ?? "",
      ]),
      styles: { fontSize: 7 }, headStyles: { fillColor: [40, 60, 100] },
    });
    doc.save(`profit_${toDateStr(startDate)}_${toDateStr(endDate)}.pdf`);
    toast({ title: "Export PDF", description: data.length > 5000 ? `Menampilkan 5000 dari ${data.length} baris di PDF.` : `${data.length} baris diekspor.` });
  };

  if (!currentStoreId) {
    return <div className="text-center py-12 text-muted-foreground">Pilih toko terlebih dulu</div>;
  }

  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Date range */}
      <div className="flex flex-wrap items-end gap-3">
        <DateInput value={startDate} onChange={setStartDate} label="Dari Tanggal" />
        <DateInput value={endDate} onChange={setEndDate} label="Sampai Tanggal" />
        <Badge variant="outline" className="ml-auto">
          Periode: {format(startDate, "dd MMM", { locale: idLocale })} - {format(endDate, "dd MMM yyyy", { locale: idLocale })}
        </Badge>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <SummaryCard
          title="Profit Hari Ini" value={fmtIDR(todaySum?.total_profit)} icon={<DollarSign className="w-6 h-6" />}
          loading={cardsLoading} tone="success" highlight={activeCard === "today"}
          onClick={() => { setActiveCard("today"); openDrillForRange(today, endOfToday(), `Hari Ini (${format(today, "dd MMM yyyy", { locale: idLocale })})`); }}
        />
        <SummaryCard
          title="Profit Minggu Ini" value={fmtIDR(weekSum?.total_profit)} icon={<TrendingUp className="w-6 h-6" />}
          loading={cardsLoading} tone="success" highlight={activeCard === "week"}
          onClick={() => { setActiveCard("week"); openDrillForRange(weekStart, endOfToday(), "Minggu Ini"); }}
        />
        <SummaryCard
          title="Profit Bulan Ini" value={fmtIDR(monthSum?.total_profit)} icon={<CalendarIco className="w-6 h-6" />}
          loading={cardsLoading} tone="success" highlight={activeCard === "month"}
          onClick={() => { setActiveCard("month"); openDrillForRange(monthStart, endOfToday(), "Bulan Ini"); }}
        />
        <SummaryCard
          title="Profit Periode" value={fmtIDR(periodSum?.total_profit)} icon={<DollarSign className="w-6 h-6" />}
          loading={cardsLoading} highlight={activeCard === "period"}
          onClick={() => { setActiveCard("period"); openDrillForRange(startDate, new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59), "Periode Terpilih"); }}
        />
        <SummaryCard
          title="Rata-rata Margin" value={fmtPct(periodSum?.avg_margin_pct)} icon={<Percent className="w-6 h-6" />}
          loading={cardsLoading}
        />
        <SummaryCard
          title="Total Transaksi" value={(periodSum?.total_transactions ?? 0).toLocaleString("id-ID")}
          icon={<ShoppingCart className="w-6 h-6" />} loading={cardsLoading}
        />
      </div>

      {/* Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-foreground">Grafik Profit</CardTitle>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Harian</SelectItem>
              <SelectItem value="week">Mingguan</SelectItem>
              <SelectItem value="month">Bulanan</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">Tidak ada data pada periode ini</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis
                  dataKey="period_start"
                  tickFormatter={(v) => format(new Date(v), groupBy === "month" ? "MMM yy" : "dd MMM", { locale: idLocale })}
                  fontSize={11}
                />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} />
                <Tooltip
                  formatter={(val: any, name: string) => {
                    if (name === "Margin") return [fmtPct(val), name];
                    return [fmtIDR(val), name];
                  }}
                  labelFormatter={(v: any) => format(new Date(v), "dd MMM yyyy", { locale: idLocale })}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" opacity={0.5}
                  onClick={(d: any) => {
                    const dt = new Date(d.period_start);
                    const end = new Date(dt);
                    if (groupBy === "day") end.setHours(23, 59, 59, 999);
                    else if (groupBy === "week") { end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999); }
                    else { end.setMonth(end.getMonth() + 1); end.setDate(0); end.setHours(23, 59, 59, 999); }
                    openDrillForRange(dt, end, format(dt, "dd MMM yyyy", { locale: idLocale }));
                  }}
                  style={{ cursor: "pointer" }}
                />
                <Bar dataKey="profit" name="Profit" fill="hsl(var(--success))"
                  onClick={(d: any) => {
                    const dt = new Date(d.period_start);
                    const end = new Date(dt);
                    if (groupBy === "day") end.setHours(23, 59, 59, 999);
                    else if (groupBy === "week") { end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999); }
                    else { end.setMonth(end.getMonth() + 1); end.setDate(0); end.setHours(23, 59, 59, 999); }
                    openDrillForRange(dt, end, format(dt, "dd MMM yyyy", { locale: idLocale }));
                  }}
                  style={{ cursor: "pointer" }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="text-xs text-muted-foreground mt-2">Klik bar untuk melihat transaksi periode tersebut.</p>
        </CardContent>
      </Card>

      {/* Top products */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Analisis Produk</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={topMetric} onValueChange={(v) => setTopMetric(v as any)}>
            <TabsList className="grid grid-cols-2 md:grid-cols-4 mb-4">
              <TabsTrigger value="most_profitable">Paling Untung</TabsTrigger>
              <TabsTrigger value="highest_margin">Margin Tertinggi</TabsTrigger>
              <TabsTrigger value="lowest_margin">Margin Terendah</TabsTrigger>
              <TabsTrigger value="below_cost" className="data-[state=active]:bg-destructive/20">
                <AlertTriangle className="w-3 h-3 mr-1" /> Di Bawah Modal
              </TabsTrigger>
            </TabsList>
            {(["most_profitable", "highest_margin", "lowest_margin", "below_cost"] as const).map((m) => (
              <TabsContent key={m} value={m} className="mt-0">
                {topLoading ? (
                  <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : topData.length === 0 ? (
                  <div className="text-center py-8">
                    {m === "below_cost" ? (
                      <div className="text-success">
                        <TrendingUp className="w-10 h-10 mx-auto mb-2" />
                        <p className="font-medium">Tidak ada produk yang terjual di bawah modal</p>
                        <p className="text-xs text-muted-foreground">Harga jual semua produk aman di atas modal.</p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Belum ada data</p>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produk</TableHead>
                          <TableHead>Varian</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topData.map((r, i) => (
                          <TableRow key={`${r.product_id}-${r.variant_id}-${i}`} className={m === "below_cost" ? "bg-destructive/5" : ""}>
                            <TableCell className="font-medium">{r.product_name ?? "-"}</TableCell>
                            <TableCell className="text-muted-foreground">{r.variant_name ?? "-"}</TableCell>
                            <TableCell className="text-right">{Number(r.quantity_sold).toLocaleString("id-ID")}</TableCell>
                            <TableCell className="text-right">{fmtIDR(r.revenue)}</TableCell>
                            <TableCell className={cn("text-right font-semibold", Number(r.profit) < 0 ? "text-destructive" : "text-success")}>{fmtIDR(r.profit)}</TableCell>
                            <TableCell className={cn("text-right", Number(r.margin_pct) < 0 ? "text-destructive" : "")}>{fmtPct(r.margin_pct)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Category & cashier */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-foreground">Profit per Kategori</CardTitle></CardHeader>
          <CardContent>
            {otherLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : categoryData.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">Belum ada data</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kategori</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryData.map((r, i) => (
                      <TableRow key={r.category_id ?? `null-${i}`}>
                        <TableCell className="font-medium">{r.category_name ?? "(Tanpa Kategori)"}</TableCell>
                        <TableCell className="text-right">{Number(r.quantity_sold).toLocaleString("id-ID")}</TableCell>
                        <TableCell className="text-right">{fmtIDR(r.revenue)}</TableCell>
                        <TableCell className="text-right text-success font-semibold">{fmtIDR(r.profit)}</TableCell>
                        <TableCell className="text-right">{fmtPct(r.margin_pct)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-foreground">Performa Kasir</CardTitle></CardHeader>
          <CardContent>
            {otherLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : cashierData.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">Belum ada data</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kasir</TableHead>
                      <TableHead className="text-right">Transaksi</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashierData.map((r, i) => (
                      <TableRow key={r.cashier_id ?? `null-${i}`}>
                        <TableCell className="font-medium">{r.cashier_name ?? "-"}</TableCell>
                        <TableCell className="text-right">{Number(r.total_transactions).toLocaleString("id-ID")}</TableCell>
                        <TableCell className="text-right">{fmtIDR(r.revenue)}</TableCell>
                        <TableCell className="text-right text-success font-semibold">{fmtIDR(r.profit)}</TableCell>
                        <TableCell className="text-right">{fmtPct(r.margin_pct)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail table */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <CardTitle className="text-foreground">Detail Profit per Item</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div>
              <Label className="text-xs">Produk</Label>
              <Select value={filterProductId} onValueChange={setFilterProductId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Produk</SelectItem>
                  {productOptions.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Kategori</Label>
              <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {categoryOptions.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Kasir</Label>
              <Select value={filterCashierId} onValueChange={setFilterCashierId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kasir</SelectItem>
                  {cashierOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Urutkan</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">Terbaru</SelectItem>
                  <SelectItem value="date_asc">Terlama</SelectItem>
                  <SelectItem value="profit_desc">Profit Tertinggi</SelectItem>
                  <SelectItem value="profit_asc">Profit Terendah</SelectItem>
                  <SelectItem value="product_asc">Produk (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Produk</TableHead>
                  <TableHead>Varian</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Modal</TableHead>
                  <TableHead className="text-right">Jual</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead>Kasir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailLoading ? (
                  [...Array(6)].map((_, i) => (
                    <TableRow key={i}>{[...Array(10)].map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Tidak ada data</TableCell></TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={`${r.sale_id}-${r.product_id}-${r.variant_id}-${i}`} className="cursor-pointer hover:bg-muted/40" onClick={() => openSale(r.sale_id)}>
                      <TableCell className="text-xs whitespace-nowrap">{format(new Date(r.sale_created_at), "dd/MM/yy HH:mm")}</TableCell>
                      <TableCell className="font-mono text-xs">{r.receipt_number ?? "-"}</TableCell>
                      <TableCell>{r.product_name ?? "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.variant_name ?? "-"}</TableCell>
                      <TableCell className="text-right">{Number(r.quantity)}</TableCell>
                      <TableCell className="text-right">{fmtIDR(r.cost_price)}</TableCell>
                      <TableCell className="text-right">{fmtIDR(r.unit_price)}</TableCell>
                      <TableCell className={cn("text-right font-semibold", Number(r.profit) < 0 ? "text-destructive" : "text-success")}>{fmtIDR(r.profit)}</TableCell>
                      <TableCell className={cn("text-right", Number(r.margin_pct) < 0 ? "text-destructive" : "")}>{fmtPct(r.margin_pct)}</TableCell>
                      <TableCell className="text-xs">{r.cashier_name ?? "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
            <p className="text-xs text-muted-foreground">
              Total <span className="font-semibold text-foreground">{totalRows.toLocaleString("id-ID")}</span> baris • Halaman {page} dari {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || detailLoading} onClick={() => setPage(p => Math.max(1, p - 1))}>
                <ChevronLeft className="w-4 h-4" /> Sebelumnya
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages || detailLoading} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                Berikutnya <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drill-down: transactions of a range */}
      <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaksi - {drillDate?.label}</DialogTitle>
            <DialogDescription>
              {drillLoading ? "Memuat..." : `${drillTx.length} transaksi. Klik salah satu untuk melihat rincian item.`}
            </DialogDescription>
          </DialogHeader>
          {drillLoading ? (
            <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : drillTx.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">Tidak ada transaksi</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jam</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Kasir</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillTx.map((t) => (
                  <TableRow key={t.sale_id} className="cursor-pointer hover:bg-muted/40" onClick={() => openSale(t.sale_id)}>
                    <TableCell className="text-xs">{format(new Date(t.sale_created_at), "dd/MM/yy HH:mm")}</TableCell>
                    <TableCell className="font-mono text-xs">{t.receipt_number ?? "-"}</TableCell>
                    <TableCell className="text-xs">{t.cashier_name ?? "-"}</TableCell>
                    <TableCell className={cn("text-right font-semibold", t.profit < 0 ? "text-destructive" : "text-success")}>{fmtIDR(t.profit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Sale items detail */}
      <Dialog open={saleOpen} onOpenChange={setSaleOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rincian Transaksi</DialogTitle>
            <DialogDescription>
              {saleItems[0]?.receipt_number ? `Invoice ${saleItems[0].receipt_number}` : `Sale ID ${saleId?.slice(0, 8)}`}
              {saleItems[0] ? ` • ${format(new Date(saleItems[0].sale_created_at), "dd MMM yyyy HH:mm", { locale: idLocale })} • Kasir: ${saleItems[0].cashier_name ?? "-"}` : ""}
            </DialogDescription>
          </DialogHeader>
          {saleLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead>Varian</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Modal</TableHead>
                  <TableHead className="text-right">Jual</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saleItems.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.product_name ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{r.variant_name ?? "-"}</TableCell>
                    <TableCell className="text-right">{Number(r.quantity)}</TableCell>
                    <TableCell className="text-right">{fmtIDR(r.cost_price)}</TableCell>
                    <TableCell className="text-right">{fmtIDR(r.unit_price)}</TableCell>
                    <TableCell className={cn("text-right font-semibold", Number(r.profit) < 0 ? "text-destructive" : "text-success")}>{fmtIDR(r.profit)}</TableCell>
                    <TableCell className="text-right">{fmtPct(r.margin_pct)}</TableCell>
                  </TableRow>
                ))}
                {saleItems.length > 0 && (
                  <TableRow className="bg-muted/30 font-semibold">
                    <TableCell colSpan={5} className="text-right">Total Profit Transaksi</TableCell>
                    <TableCell className="text-right text-success">
                      {fmtIDR(saleItems.reduce((s, r) => s + Number(r.profit ?? 0), 0))}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

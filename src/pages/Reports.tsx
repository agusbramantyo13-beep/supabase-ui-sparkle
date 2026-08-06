import { useState, useEffect } from "react";
import { BarChart3, DollarSign, TrendingUp, Calendar, Download, Users, LineChart } from "lucide-react";
import ProfitDashboard from "@/components/ProfitDashboard";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/contexts/StoreContext";
import MemberTransactionReport from "@/components/MemberTransactionReport";
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

const compactIDR = (v: number) => {
  const n = Number(v || 0);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}rb`;
  return `${n}`;
};

interface ReportData {
  totalSales: number;
  totalProfit: number;
  totalTransactions: number;
  averageOrderValue: number;
  salesByDate: any[];
  topProducts: any[];
}

export default function Reports() {
  useAuth();
  const { currentStoreId, userStoreRole } = useStore();
  const isOwner = userStoreRole === 'owner';
  const [reportData, setReportData] = useState<ReportData>({
    totalSales: 0,
    totalProfit: 0,
    totalTransactions: 0,
    averageOrderValue: 0,
    salesByDate: [],
    topProducts: []
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("30");

  const chartData = [...(reportData.salesByDate || [])]
    .filter((d: any) => d?.day)
    .sort((a: any, b: any) => new Date(a.day).getTime() - new Date(b.day).getTime())
    .map((d: any) => ({
      label: new Date(d.day).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      total: Number(d.total_sales || 0),
      receipts: Number(d.receipts || 0),
    }));

  useEffect(() => {
    fetchReportData();
  }, [dateRange, currentStoreId, isOwner]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));

      // Fetch sales data
      const { data: salesData } = await supabase
        .from('sales')
        .select('*')
        .eq('store_id', currentStoreId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Fetch sales summary
      const { data: summaryData } = await supabase
        .from('v_sales_summary')
        .select('*')
        .gte('day', startDate.toISOString().split('T')[0])
        .lte('day', endDate.toISOString().split('T')[0]);

      // Fetch profit data per-store via RPC (only for owner/developer)
      let totalProfit = 0;
      if (isOwner && currentStoreId) {
        const { data: profitSummary, error: profitError } = await supabase.rpc('get_profit_summary', {
          p_store_id: currentStoreId,
          p_start: startDate.toISOString().split('T')[0],
          p_end: endDate.toISOString().split('T')[0],
        });
        if (profitError) console.error('Error fetching profit summary:', profitError);
        totalProfit = Number(profitSummary?.[0]?.total_profit || 0);
      }

      // Fetch other sales (lain-lain) in the range
      const { data: otherSalesData } = await supabase
        .from('other_sales')
        .select('amount, sale_date')
        .eq('store_id', currentStoreId)
        .gte('sale_date', startDate.toISOString().split('T')[0])
        .lte('sale_date', endDate.toISOString().split('T')[0]);

      const otherSalesTotal = otherSalesData?.reduce((sum, r: any) => sum + Number(r.amount || 0), 0) || 0;

      const productSalesTotal = salesData?.reduce((sum, sale) => sum + Number(sale.total || 0), 0) || 0;
      const totalSales = productSalesTotal + otherSalesTotal;
      const totalTransactions = salesData?.length || 0;
      const averageOrderValue = totalTransactions > 0 ? totalSales / totalTransactions : 0;

      setReportData({
        totalSales,
        totalProfit,
        totalTransactions,
        averageOrderValue,
        salesByDate: summaryData || [],
        topProducts: []
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Reports</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-card animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground">Track your business performance</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className={cn("grid w-full max-w-lg", isOwner ? "grid-cols-3" : "grid-cols-2")}>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Overview
          </TabsTrigger>
          {isOwner && (
            <TabsTrigger value="profit" className="flex items-center gap-2">
              <LineChart className="w-4 h-4" />
              Profit
            </TabsTrigger>
          )}
          <TabsTrigger value="member" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Transaksi Member
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Date Range & Export */}
          <div className="flex justify-end gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 3 months</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Sales</p>
                    <p className="num text-2xl font-semibold text-foreground">
                      Rp {reportData.totalSales.toLocaleString('id-ID')}
                    </p>
                    <p className="text-xs text-success">+12% from previous period</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            {isOwner && (
              <Card className="bg-card border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Profit</p>
                      <p className="num text-2xl font-semibold text-foreground">
                        Rp {reportData.totalProfit.toLocaleString('id-ID')}
                      </p>
                      <p className="text-xs text-success">+8% from previous period</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-success" />
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Transactions</p>
                    <p className="num text-2xl font-semibold text-foreground">
                      {reportData.totalTransactions.toLocaleString('id-ID')}
                    </p>
                    <p className="text-xs text-warning">-2% from previous period</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg. Order Value</p>
                    <p className="num text-2xl font-semibold text-foreground">
                      Rp {reportData.averageOrderValue.toFixed(2)}
                    </p>
                    <p className="text-xs text-success">+5% from previous period</p>
                  </div>
                  <Calendar className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sales Chart */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Sales Overview</CardTitle>
              <p className="text-xs text-muted-foreground">
                Penjualan harian ({dateRange} hari terakhir)
              </p>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="label"
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={16}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={64}
                        tickFormatter={(v: number) => compactIDR(v)}
                      />
                      <Tooltip
                        cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.25 }}
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          color: "hsl(var(--popover-foreground))",
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                        formatter={(value: any, name: any) =>
                          name === "Penjualan"
                            ? [`Rp ${Number(value).toLocaleString("id-ID")}`, "Penjualan"]
                            : [`${Number(value).toLocaleString("id-ID")} transaksi`, "Transaksi"]
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        name="Penjualan"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#salesFill)"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="receipts"
                        name="Transaksi"
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                        dot={false}
                        hide
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-center">
                  <div>
                    <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground">Belum ada penjualan pada periode ini</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sales Summary Table */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Daily Sales Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {reportData.salesByDate.length > 0 ? (
                <div className="space-y-4">
                  {reportData.salesByDate.map((day, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-muted/20 rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">
                          {new Date(day.day).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {day.receipts} transactions
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">
                          Rp {Number(day.total_sales || 0).toLocaleString('id-ID')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Discounts: Rp {Number(day.total_discounts || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No sales data for selected period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isOwner && (
          <TabsContent value="profit">
            <ProfitDashboard />
          </TabsContent>
        )}

        <TabsContent value="member">
          <MemberTransactionReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
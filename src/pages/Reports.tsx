import { useState, useEffect } from "react";
import { BarChart3, DollarSign, TrendingUp, Calendar, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ReportData {
  totalSales: number;
  totalProfit: number;
  totalTransactions: number;
  averageOrderValue: number;
  salesByDate: any[];
  topProducts: any[];
}

export default function Reports() {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
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

  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        
        setUserRole(data?.role || null);
      }
    };
    
    fetchUserRole();
  }, [user]);

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

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
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Fetch sales summary
      const { data: summaryData } = await supabase
        .from('v_sales_summary')
        .select('*')
        .gte('day', startDate.toISOString().split('T')[0])
        .lte('day', endDate.toISOString().split('T')[0]);

      // Fetch profit data (only if not store keeper)
      let totalProfit = 0;
      if (userRole !== 'store_keeper') {
        const { data: profitData } = await supabase
          .from('v_profit_by_date')
          .select('*')
          .gte('day', startDate.toISOString().split('T')[0])
          .lte('day', endDate.toISOString().split('T')[0]);
        
        totalProfit = profitData?.reduce((sum, profit) => sum + Number(profit.profit || 0), 0) || 0;
      }

      const totalSales = salesData?.reduce((sum, sale) => sum + Number(sale.total || 0), 0) || 0;
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
          <h1 className="text-3xl font-bold text-foreground">Reports</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-gradient-card animate-pulse">
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
          <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground">Track your business performance</p>
        </div>
        <div className="flex gap-2">
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
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold text-foreground">
                  Rp {reportData.totalSales.toLocaleString()}
                </p>
                <p className="text-xs text-success">+12% from previous period</p>
              </div>
              <DollarSign className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        {userRole !== 'store_keeper' && (
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Profit</p>
                  <p className="text-2xl font-bold text-foreground">
                    Rp {reportData.totalProfit.toLocaleString()}
                  </p>
                  <p className="text-xs text-success">+8% from previous period</p>
                </div>
                <TrendingUp className="w-8 h-8 text-success" />
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Transactions</p>
                <p className="text-2xl font-bold text-foreground">
                  {reportData.totalTransactions.toLocaleString()}
                </p>
                <p className="text-xs text-warning">-2% from previous period</p>
              </div>
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg. Order Value</p>
                <p className="text-2xl font-bold text-foreground">
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
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="text-foreground">Sales Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-4" />
              <p>Sales chart visualization would go here</p>
              <p className="text-sm">Integration with chart library needed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Summary Table */}
      <Card className="bg-gradient-card border-border/50">
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
                      Rp {Number(day.total_sales || 0).toLocaleString()}
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
    </div>
  );
}
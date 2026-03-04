import { useEffect, useState } from "react"
import { DollarSign, Package, ShoppingCart, TrendingUp, Users, Warehouse } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useStore } from "@/contexts/StoreContext"
import { StatCard } from "@/components/StatCard"
import { SalesByCategoryReport } from "@/components/SalesByCategoryReport"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useNavigate } from "react-router-dom"

interface DashboardStats {
  totalSales: number
  totalProducts: number
  totalOrders: number
  totalUsers: number
  lowStockItems: number
  recentSales: any[]
  inventoryValue: number
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalUsers: 0,
    lowStockItems: 0,
    recentSales: [],
    inventoryValue: 0
  })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { currentStoreId } = useStore()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Fetch sales data
      const { data: salesData } = await supabase
        .from('sales')
        .select('total')
        .eq('store_id', currentStoreId)
      // Fetch products count
      const { data: productsData, count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('store_id', currentStoreId)

      // Fetch orders count
      const { data: ordersData, count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact' })

      // Fetch users count
      const { data: usersData, count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })

      // Fetch recent sales
      const { data: recentSales } = await supabase
        .from('sales')
        .select(`
          *,
          profiles!sales_user_id_fkey(email)
        `)
        .eq('store_id', currentStoreId)
        .order('created_at', { ascending: false })
        .limit(5)

      // Calculate total capital value (modal) from inventory
      const { data: inventoryData } = await supabase
        .from('inventory')
        .select(`
          quantity,
          variants!inner(cost_price)
        `)
        .eq('store_id', currentStoreId)
      
      const totalCapital = inventoryData?.reduce((sum, item) => {
        const costPrice = Number(item.variants?.cost_price || 0)
        const quantity = Number(item.quantity || 0)
        return sum + (costPrice * quantity)
      }, 0) || 0

      // Calculate totals
      const totalSales = salesData?.reduce((sum, sale) => sum + Number(sale.total || 0), 0) || 0

      // Calculate low stock items
      const lowStockCount = inventoryData?.filter(item => item.quantity < 10).length || 0

      setStats({
        totalSales,
        totalProducts: productsCount || 0,
        totalOrders: ordersCount || 0,
        totalUsers: usersCount || 0,
        lowStockItems: lowStockCount,
        recentSales: recentSales || [],
        inventoryValue: totalCapital
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
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
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening in your store.</p>
        </div>
        <Button 
          className="bg-gradient-primary hover:bg-primary/90"
          onClick={() => navigate('/sales')}
        >
          New Sale
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Sales"
          value={`Rp ${stats.totalSales.toLocaleString()}`}
          subtitle="This month"
          icon={<DollarSign className="w-6 h-6 text-primary-foreground" />}
          trend={{ value: "+12%", isPositive: true }}
        />
        
        <StatCard
          title="Products"
          value={stats.totalProducts}
          subtitle="Active products"
          icon={<Package className="w-6 h-6 text-primary-foreground" />}
        />
        
        <StatCard
          title="Orders"
          value={stats.totalOrders}
          subtitle="Total orders"
          icon={<ShoppingCart className="w-6 h-6 text-primary-foreground" />}
          trend={{ value: "+8%", isPositive: true }}
        />
        
        <StatCard
          title="Users"
          value={stats.totalUsers}
          subtitle="Active users"
          icon={<Users className="w-6 h-6 text-primary-foreground" />}
        />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Inventory Value"
          value={`Rp ${stats.inventoryValue.toLocaleString()}`}
          subtitle="Current stock value"
          icon={<Warehouse className="w-6 h-6 text-primary-foreground" />}
        />
        
        <StatCard
          title="Low Stock Alert"
          value={stats.lowStockItems}
          subtitle="Items need restocking"
          icon={<TrendingUp className="w-6 h-6 text-warning-foreground" />}
          className="border-warning/20"
        />
        
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/products')}
              >
                <Package className="w-4 h-4 mr-2" />
                Add Product
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/sales')}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Process Sale
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/inventory')}
              >
                <Warehouse className="w-4 h-4 mr-2" />
                Update Inventory
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales by Category Report */}
      <SalesByCategoryReport />

      {/* Recent Activity */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="text-foreground">Penjualan Terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.recentSales.length > 0 ? (
              stats.recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-4 bg-muted/20 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Receipt #{sale.receipt_number || sale.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(sale.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-foreground">
                      Rp {Number(sale.total).toLocaleString()}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {sale.payment_method || 'Cash'}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Belum ada penjualan</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate('/sales')}>
                  Buat Penjualan Pertama
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
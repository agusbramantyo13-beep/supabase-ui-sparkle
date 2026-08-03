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
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-14 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="toolbar">
        <div>
          <h1 className="page-title">Dasbor</h1>
          <p className="page-subtitle">Ringkasan operasional toko hari ini.</p>
        </div>
        <Button
          className="tap-target"
          onClick={() => navigate('/sales')}
        >
          <ShoppingCart className="w-4 h-4 mr-2" aria-hidden="true" />
          Penjualan Baru
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Total Penjualan"
          value={`Rp ${stats.totalSales.toLocaleString('id-ID')}`}
          subtitle="Akumulasi toko ini"
          icon={<DollarSign className="w-5 h-5" />}
        />

        <StatCard
          title="Produk"
          value={stats.totalProducts}
          subtitle="Produk aktif"
          icon={<Package className="w-5 h-5" />}
        />

        <StatCard
          title="Pesanan"
          value={stats.totalOrders}
          subtitle="Total pesanan"
          icon={<ShoppingCart className="w-5 h-5" />}
        />

        <StatCard
          title="Pengguna"
          value={stats.totalUsers}
          subtitle="Pengguna aktif"
          icon={<Users className="w-5 h-5" />}
        />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          title="Nilai Inventori"
          value={`Rp ${stats.inventoryValue.toLocaleString('id-ID')}`}
          subtitle="Nilai modal stok saat ini"
          icon={<Warehouse className="w-5 h-5" />}
        />

        <StatCard
          title="Stok Menipis"
          value={stats.lowStockItems}
          subtitle="Item perlu restock"
          status={stats.lowStockItems > 0 ? "warning" : "none"}
          icon={<TrendingUp className="w-5 h-5" />}
        />

        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Aksi Cepat</h2>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start tap-target"
                onClick={() => navigate('/products')}
              >
                <Package className="w-4 h-4 mr-2" aria-hidden="true" />
                Tambah Produk
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start tap-target"
                onClick={() => navigate('/sales')}
              >
                <ShoppingCart className="w-4 h-4 mr-2" aria-hidden="true" />
                Proses Penjualan
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start tap-target"
                onClick={() => navigate('/inventory')}
              >
                <Warehouse className="w-4 h-4 mr-2" aria-hidden="true" />
                Perbarui Inventori
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales by Category Report */}
      <SalesByCategoryReport />

      {/* Recent Activity */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Penjualan Terbaru
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="divide-y divide-border">
            {stats.recentSales.length > 0 ? (
              stats.recentSales.map((sale) => (
                <li key={sale.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      Nota #{sale.receipt_number || sale.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(sale.created_at).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="num text-base font-semibold text-foreground">
                      Rp {Number(sale.total).toLocaleString('id-ID')}
                    </p>
                    <Badge variant="secondary" className="text-[11px] font-normal">
                      {sale.payment_method || 'Cash'}
                    </Badge>
                  </div>
                </li>
              ))
            ) : (
              <li className="text-center py-8">
                <ShoppingCart className="w-10 h-10 mx-auto text-muted-foreground mb-3" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Belum ada penjualan</p>
                <Button variant="outline" className="mt-4 tap-target" onClick={() => navigate('/sales')}>
                  Buat Penjualan Pertama
                </Button>
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

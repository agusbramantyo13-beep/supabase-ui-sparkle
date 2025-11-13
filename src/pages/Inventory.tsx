import { useEffect, useState } from "react"
import { Warehouse, AlertTriangle, TrendingUp, TrendingDown, Download, ShoppingCart } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InventoryForm } from "@/components/InventoryForm"
import { StockPurchaseForm } from "@/components/StockPurchaseForm"
import { StockAdjustmentForm } from "@/components/StockAdjustmentForm"
import * as XLSX from 'xlsx'
import { useToast } from "@/hooks/use-toast"

interface InventoryItem {
  variant_id: number
  quantity: number
  product_name: string
  variant_name: string
  category_name: string
}

export default function Inventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [inventoryFormOpen, setInventoryFormOpen] = useState(false)
  const [formType, setFormType] = useState<'add' | 'remove' | 'adjust'>('add')
  const [purchaseFormOpen, setPurchaseFormOpen] = useState(false)
  const [adjustmentFormOpen, setAdjustmentFormOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchInventory()
  }, [])

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('v_current_inventory')
        .select('*')
        .order('quantity', { ascending: true })

      if (error) throw error
      setInventory(data || [])
    } catch (error) {
      console.error('Error fetching inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  const lowStockItems = inventory.filter(item => (item.quantity || 0) < 10)
  const outOfStockItems = inventory.filter(item => (item.quantity || 0) === 0)

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { label: 'Out of Stock', variant: 'destructive' as const, icon: AlertTriangle }
    if (quantity < 10) return { label: 'Low Stock', variant: 'secondary' as const, icon: TrendingDown }
    return { label: 'In Stock', variant: 'default' as const, icon: TrendingUp }
  }

  const handleDownloadExcel = () => {
    try {
      // Prepare data for Excel
      const excelData = inventory.map(item => ({
        'Nama Produk': item.product_name,
        'Varian': item.variant_name,
        'Kategori': item.category_name,
        'Jumlah Stok': item.quantity || 0,
        'Status': getStockStatus(item.quantity || 0).label
      }))

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(excelData)
      
      // Create workbook
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory')
      
      // Generate filename with current date
      const date = new Date().toISOString().split('T')[0]
      const filename = `inventory_${date}.xlsx`
      
      // Download file
      XLSX.writeFile(wb, filename)
      
      toast({
        title: "Berhasil",
        description: "Data inventory berhasil diunduh",
      })
    } catch (error) {
      console.error('Error downloading Excel:', error)
      toast({
        title: "Error",
        description: "Gagal mengunduh data inventory",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventory</h1>
          <p className="text-muted-foreground">Monitor and manage your stock levels</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleDownloadExcel}
            disabled={inventory.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Download Excel
          </Button>
          <Button 
            className="bg-gradient-primary hover:bg-primary/90"
            onClick={() => setPurchaseFormOpen(true)}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Input Pembelian
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              setFormType('add');
              setInventoryFormOpen(true);
            }}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Add Stock
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              setFormType('remove');
              setInventoryFormOpen(true);
            }}
          >
            <TrendingDown className="w-4 h-4 mr-2" />
            Remove Stock
          </Button>
          <Button 
            variant="outline"
            onClick={() => setAdjustmentFormOpen(true)}
          >
            <Warehouse className="w-4 h-4 mr-2" />
            Adjust Stock Multi-Item
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold text-foreground">{inventory.length}</p>
              </div>
              <Warehouse className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Stock</p>
                <p className="text-2xl font-bold text-success">
                  {inventory.filter(item => (item.quantity || 0) > 10).length}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-warning">{lowStockItems.length}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Out of Stock</p>
                <p className="text-2xl font-bold text-destructive">{outOfStockItems.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory List */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="text-foreground">Current Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          {inventory.length > 0 ? (
            <div className="space-y-4">
              {inventory.map((item) => {
                const status = getStockStatus(item.quantity || 0)
                const StatusIcon = status.icon
                
                return (
                  <div 
                    key={`${item.variant_id}-${item.product_name}-${item.variant_name}`} 
                    className="flex items-center justify-between p-4 bg-muted/20 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <h4 className="font-medium text-foreground">
                            {item.product_name} - {item.variant_name}
                          </h4>
                          <p className="text-sm text-muted-foreground">{item.category_name}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-semibold text-foreground">
                          {item.quantity || 0} units
                        </p>
                      </div>
                      
                      <Badge variant={status.variant} className="flex items-center gap-1">
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Warehouse className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Inventory Data</h3>
              <p className="text-muted-foreground mb-6">
                Start tracking your inventory by adding products and stock levels.
              </p>
              <Button 
                className="bg-gradient-primary hover:bg-primary/90"
                onClick={() => {
                  setFormType('add');
                  setInventoryFormOpen(true);
                }}
              >
                Add Inventory
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <StockPurchaseForm
        open={purchaseFormOpen}
        onOpenChange={setPurchaseFormOpen}
        onSuccess={fetchInventory}
      />

      <StockAdjustmentForm
        open={adjustmentFormOpen}
        onOpenChange={setAdjustmentFormOpen}
        onSuccess={fetchInventory}
      />

      <InventoryForm
        open={inventoryFormOpen}
        onOpenChange={setInventoryFormOpen}
        onSuccess={fetchInventory}
        type={formType}
      />
    </div>
  )
}
import { useEffect, useState } from "react"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { CalendarIcon, ChevronDown, ChevronRight, Package } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { useStore } from "@/contexts/StoreContext"

interface SaleItem {
  product_name: string
  variant_name: string
  quantity: number
  total: number
}

interface CategorySales {
  category_name: string
  total_sales: number
  total_items: number
  items: SaleItem[]
}

export function SalesByCategoryReport() {
  const { currentStoreId } = useStore();
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  )
  const [endDate, setEndDate] = useState<Date | undefined>(new Date())
  const [categorySales, setCategorySales] = useState<CategorySales[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const fetchSalesData = async () => {
    if (!startDate || !endDate) return

    setLoading(true)
    try {
      const startISO = format(startDate, "yyyy-MM-dd") + "T00:00:00"
      const endISO = format(endDate, "yyyy-MM-dd") + "T23:59:59"

      // Fetch sale items with variant, product, and category info
      let salesQuery = supabase
        .from('sale_items')
        .select(`
          quantity,
          total,
          product_snapshot,
          variant_id,
          sales!inner(created_at, store_id)
        `)
        .gte('sales.created_at', startISO)
        .lte('sales.created_at', endISO)
      if (currentStoreId) salesQuery = salesQuery.eq('sales.store_id', currentStoreId)
      const { data: saleItems, error } = await salesQuery

      if (error) throw error

      // Get all unique variant_ids
      const variantIds = [...new Set((saleItems || []).map(item => item.variant_id).filter(Boolean))]

      // Fetch variant details with product and category
      let variantMap = new Map<number, { variant_name: string; product_name: string; category_name: string }>()
      
      if (variantIds.length > 0) {
        const { data: variants } = await supabase
          .from('variants')
          .select(`
            id,
            name,
            products!inner(
              name,
              categories(name)
            )
          `)
          .in('id', variantIds)

        for (const v of variants || []) {
          const product = v.products as any
          variantMap.set(v.id, {
            variant_name: v.name,
            product_name: product?.name || 'Unknown',
            category_name: product?.categories?.name || 'Tanpa Kategori'
          })
        }
      }

      // Group by category
      const categoryMap = new Map<string, CategorySales>()

      for (const item of saleItems || []) {
        const snapshot = item.product_snapshot as any
        const variantInfo = item.variant_id ? variantMap.get(item.variant_id) : null
        
        // Use variant info if available, fallback to snapshot
        const categoryName = variantInfo?.category_name || 'Tanpa Kategori'
        const productName = variantInfo?.product_name || snapshot?.name?.split(' - ')[0] || 'Unknown'
        const variantName = variantInfo?.variant_name || snapshot?.name?.split(' - ')[1] || 'Default'

        if (!categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, {
            category_name: categoryName,
            total_sales: 0,
            total_items: 0,
            items: []
          })
        }

        const category = categoryMap.get(categoryName)!
        category.total_sales += Number(item.total)
        category.total_items += Number(item.quantity)

        // Check if item already exists
        const existingItem = category.items.find(
          i => i.product_name === productName && i.variant_name === variantName
        )

        if (existingItem) {
          existingItem.quantity += Number(item.quantity)
          existingItem.total += Number(item.total)
        } else {
          category.items.push({
            product_name: productName,
            variant_name: variantName,
            quantity: Number(item.quantity),
            total: Number(item.total)
          })
        }
      }

      // Sort by total sales descending
      const sortedCategories = Array.from(categoryMap.values()).sort(
        (a, b) => b.total_sales - a.total_sales
      )

      setCategorySales(sortedCategories)
    } catch (error) {
      console.error('Error fetching sales data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSalesData()
  }, [startDate, endDate, currentStoreId])

  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName)
    } else {
      newExpanded.add(categoryName)
    }
    setExpandedCategories(newExpanded)
  }

  const grandTotal = categorySales.reduce((sum, cat) => sum + cat.total_sales, 0)
  const grandItems = categorySales.reduce((sum, cat) => sum + cat.total_items, 0)

  return (
    <Card className="bg-gradient-card border-border/50">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Package className="w-5 h-5" />
          Laporan Penjualan per Kategori
        </CardTitle>
        
        {/* Date Range Filter */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Dari:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[160px] justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd MMM yyyy", { locale: id }) : "Pilih tanggal"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sampai:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[160px] justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "dd MMM yyyy", { locale: id }) : "Pilih tanggal"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : categorySales.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Tidak ada data penjualan dalam periode ini</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Summary */}
            <div className="bg-primary/10 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Penjualan</p>
                  <p className="text-2xl font-bold text-foreground">
                    Rp {grandTotal.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Item Terjual</p>
                  <p className="text-2xl font-bold text-foreground">
                    {grandItems.toLocaleString()} item
                  </p>
                </div>
              </div>
            </div>

            {/* Category List */}
            {categorySales.map((category) => (
              <Collapsible
                key={category.category_name}
                open={expandedCategories.has(category.category_name)}
                onOpenChange={() => toggleCategory(category.category_name)}
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {expandedCategories.has(category.category_name) ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium text-foreground">{category.category_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {category.total_items} item terjual
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-semibold text-foreground">
                      Rp {category.total_sales.toLocaleString()}
                    </p>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="mt-2 ml-7 border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead>Produk</TableHead>
                          <TableHead>Varian</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {category.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.product_name}</TableCell>
                            <TableCell className="text-muted-foreground">{item.variant_name}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">
                              Rp {item.total.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

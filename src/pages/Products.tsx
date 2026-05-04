import { useState, useEffect } from "react"
import { Package, Plus, Edit, Trash2, Search, Filter, ChevronDown, ChevronRight, PackagePlus } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useStore } from "@/contexts/StoreContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ProductForm } from "@/components/ProductForm"
import { AddVariantDialog } from "@/components/AddVariantDialog"
import { useToast } from "@/hooks/use-toast"
import { formatRupiah } from "@/lib/utils"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

interface Variant {
  id: number
  name: string
  price: number
  cost_price: number
  sku: string | null
  inventory?: Array<{ quantity: number }>
}

interface Product {
  id: number
  name: string
  created_at: string
  category_id: number
  categories?: { name: string }
  variants?: Variant[]
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [productFormOpen, setProductFormOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set())
  const [addVariantOpen, setAddVariantOpen] = useState(false)
  const [productForVariant, setProductForVariant] = useState<Product | null>(null)
  const { toast } = useToast()
  const { currentStoreId } = useStore()

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories(name),
          variants(
            id,
            name,
            price,
            cost_price,
            sku,
            inventory(quantity)
          )
        `)
        .eq('store_id', currentStoreId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProduct = async () => {
    if (!productToDelete) return

    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productToDelete.id)

      if (error) throw error

      toast({ title: "Berhasil", description: "Produk berhasil dihapus" })
      fetchProducts()
      setDeleteDialogOpen(false)
      setProductToDelete(null)
    } catch (error) {
      console.error('Error deleting product:', error)
      toast({ title: "Gagal", description: "Gagal menghapus produk", variant: "destructive" })
    } finally {
      setIsDeleting(false)
    }
  }

  const openDeleteDialog = (product: Product) => {
    setProductToDelete(product)
    setDeleteDialogOpen(true)
  }

  const toggleExpanded = (productId: number) => {
    setExpandedProducts(prev => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const getTotalStock = (product: Product) => {
    return product.variants?.reduce((sum, v) => sum + (v.inventory?.[0]?.quantity || 0), 0) || 0
  }

  const sortVariants = (variants: Variant[]): Variant[] => {
    return [...variants].sort((a, b) =>
      a.name.localeCompare(b.name, 'id-ID', { numeric: true, sensitivity: 'base' })
    )
  }

  const handleEditVariant = async (product: Product, variant: Variant) => {
    setSelectedProduct({
      id: product.id,
      name: product.name,
      category_id: product.category_id,
      category_name: product.categories?.name,
      variant_id: variant.id,
      variant_name: variant.name,
      variant_price: variant.price,
      variant_cost_price: variant.cost_price,
      variant_sku: variant.sku,
      quantity: variant.inventory?.[0]?.quantity || 0
    })
    setProductFormOpen(true)
  }

  const availableCategories = Array.from(
    new Set(products.map(p => p.categories?.name).filter(Boolean) as string[])
  ).sort()

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "all" || product.categories?.name === selectedCategory
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Produk</h1>
          <p className="text-muted-foreground">Kelola katalog produk Anda</p>
        </div>
        <Button 
          className="bg-gradient-primary hover:bg-primary/90"
          onClick={() => { setSelectedProduct(null); setProductFormOpen(true); }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Produk
        </Button>
      </div>

      {/* Search */}
      <Card className="bg-gradient-card border-border/50">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Cari produk..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="md:w-56">
                <SelectValue placeholder="Semua kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua kategori</SelectItem>
                {availableCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products List */}
      {filteredProducts.length > 0 ? (
        <div className="space-y-3">
          {filteredProducts.map((product) => {
            const isExpanded = expandedProducts.has(product.id)
            const totalStock = getTotalStock(product)
            const variantCount = product.variants?.length || 0

            return (
              <Card key={product.id} className="bg-gradient-card border-border/50 overflow-hidden">
                {/* Product Header Row */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpanded(product.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                    )}
                    <Package className="w-5 h-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {product.categories && (
                          <Badge variant="secondary" className="text-xs">{product.categories.name}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{variantCount} varian</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Badge
                      variant={totalStock > 10 ? "default" : totalStock > 0 ? "outline" : "destructive"}
                      className="text-xs"
                    >
                      Stok: {totalStock}
                    </Badge>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setProductForVariant(product)
                          setAddVariantOpen(true)
                        }}
                        title="Tambah Varian"
                      >
                        <PackagePlus className="w-3 h-3 mr-1" />
                        Varian
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteDialog(product)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded Variants */}
                {isExpanded && product.variants && product.variants.length > 0 && (
                  <div className="border-t border-border/50">
                    {sortVariants(product.variants).map((variant) => {
                      const stock = variant.inventory?.[0]?.quantity || 0
                      return (
                        <div
                          key={variant.id}
                          className="flex items-center justify-between px-4 py-3 pl-14 hover:bg-muted/20 transition-colors border-b border-border/30 last:border-b-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground">{variant.name}</p>
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                              <span>Harga: {formatRupiah(variant.price)}</span>
                              {variant.cost_price > 0 && (
                                <span>Modal: {formatRupiah(variant.cost_price)}</span>
                              )}
                              {variant.sku && <span>SKU: {variant.sku}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <Badge
                              variant={stock > 10 ? "default" : stock > 0 ? "outline" : "destructive"}
                              className="text-xs"
                            >
                              Stok: {stock}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditVariant(product, variant)}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Ubah
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Produk Tidak Ditemukan</h3>
            <p className="text-muted-foreground mb-6">
              {searchTerm ? 'Tidak ada produk yang cocok dengan pencarian.' : 'Mulai dengan menambahkan produk pertama Anda.'}
            </p>
            <Button
              className="bg-gradient-primary hover:bg-primary/90"
              onClick={() => { setSelectedProduct(null); setProductFormOpen(true); }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Tambah Produk
            </Button>
          </CardContent>
        </Card>
      )}

      <ProductForm
        open={productFormOpen}
        onOpenChange={(open) => {
          setProductFormOpen(open)
          if (!open) setSelectedProduct(null)
        }}
        onSuccess={() => {
          fetchProducts()
          setSelectedProduct(null)
        }}
        product={selectedProduct}
      />

      <AddVariantDialog
        open={addVariantOpen}
        onOpenChange={(open) => {
          setAddVariantOpen(open)
          if (!open) setProductForVariant(null)
        }}
        onSuccess={() => {
          fetchProducts()
          if (productForVariant) {
            setExpandedProducts(prev => new Set(prev).add(productForVariant.id))
          }
        }}
        productId={productForVariant?.id ?? null}
        productName={productForVariant?.name ?? ""}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Produk</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus "{productToDelete?.name}"? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

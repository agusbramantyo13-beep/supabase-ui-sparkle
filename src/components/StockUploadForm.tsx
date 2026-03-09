import { useState, useRef } from "react"
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import * as XLSX from 'xlsx'
import { useStore } from "@/contexts/StoreContext"

interface StockUploadFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface UploadRow {
  product_name: string
  category_name: string
  variant_name: string
  quantity: number
  cost_price: number
  selling_price: number
  sku: string
  status: 'valid' | 'invalid'
  message?: string
}

export function StockUploadForm({ open, onOpenChange, onSuccess }: StockUploadFormProps) {
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [uploadedData, setUploadedData] = useState<UploadRow[]>([])
  const [fileName, setFileName] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { currentStoreId } = useStore()

  const resetForm = () => {
    setUploadedData([])
    setFileName('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setProcessing(true)

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

      if (jsonData.length === 0) {
        toast({
          title: "File Kosong",
          description: "File Excel tidak memiliki data",
          variant: "destructive",
        })
        setProcessing(false)
        return
      }

      const processedData: UploadRow[] = jsonData.map(row => {
        const productName = String(row['Nama Produk'] || row['nama_produk'] || row['product_name'] || '').trim()
        const categoryName = String(row['Kategori'] || row['kategori'] || row['category'] || '').trim()
        const variantName = String(row['Varian'] || row['varian'] || row['variant'] || '').trim()
        const quantity = parseInt(row['Jumlah'] || row['jumlah'] || row['quantity'] || '0')
        const costPrice = parseFloat(row['Harga Beli'] || row['harga_beli'] || row['cost_price'] || '0')
        const sellingPrice = parseFloat(row['Harga Jual'] || row['harga_jual'] || row['selling_price'] || '0')
        const sku = String(row['SKU'] || row['sku'] || '').trim()

        const errors: string[] = []
        if (!productName) errors.push('Nama produk kosong')
        if (!variantName) errors.push('Varian kosong')
        if (isNaN(quantity) || quantity < 0) errors.push('Jumlah tidak valid')
        if (isNaN(sellingPrice) || sellingPrice < 0) errors.push('Harga jual tidak valid')

        return {
          product_name: productName,
          category_name: categoryName,
          variant_name: variantName,
          quantity: isNaN(quantity) ? 0 : quantity,
          cost_price: isNaN(costPrice) ? 0 : costPrice,
          selling_price: isNaN(sellingPrice) ? 0 : sellingPrice,
          sku,
          status: errors.length > 0 ? 'invalid' as const : 'valid' as const,
          message: errors.length > 0 ? errors.join(', ') : undefined,
        }
      })

      setUploadedData(processedData)
    } catch (error) {
      console.error('Error parsing Excel:', error)
      toast({
        title: "Error",
        description: "Gagal membaca file Excel",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleSubmit = async () => {
    const validRows = uploadedData.filter(row => row.status === 'valid')

    if (validRows.length === 0) {
      toast({
        title: "Tidak Ada Data Valid",
        description: "Tidak ada data yang valid untuk diproses",
        variant: "destructive",
      })
      return
    }

    setUploading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // 1. Collect unique categories and ensure they exist
      const uniqueCategories = [...new Set(validRows.map(r => r.category_name).filter(Boolean))]
      const categoryMap = new Map<string, number>()

      if (uniqueCategories.length > 0) {
        // Fetch existing categories
        const { data: existingCats } = await supabase
          .from('categories')
          .select('id, name')
          .eq('store_id', currentStoreId)
          .in('name', uniqueCategories)

        existingCats?.forEach(c => categoryMap.set(c.name.toLowerCase(), c.id))

        // Create missing categories
        const missingCats = uniqueCategories.filter(c => !categoryMap.has(c.toLowerCase()))
        for (const catName of missingCats) {
          const { data: newCat } = await supabase
            .from('categories')
            .insert({ name: catName, store_id: currentStoreId })
            .select('id, name')
            .single()
          if (newCat) categoryMap.set(newCat.name.toLowerCase(), newCat.id)
        }
      }

      // 2. Collect unique products and ensure they exist
      const uniqueProducts = [...new Set(validRows.map(r => r.product_name))]
      const productMap = new Map<string, number>()

      const { data: existingProducts } = await supabase
        .from('products')
        .select('id, name')
        .eq('store_id', currentStoreId)
        .in('name', uniqueProducts)

      existingProducts?.forEach(p => productMap.set(p.name.toLowerCase(), p.id))

      // Create missing products (pick category from first row with that product)
      const missingProducts = uniqueProducts.filter(p => !productMap.has(p.toLowerCase()))
      for (const prodName of missingProducts) {
        const row = validRows.find(r => r.product_name === prodName)
        const categoryId = row?.category_name ? categoryMap.get(row.category_name.toLowerCase()) : null
        const { data: newProd } = await supabase
          .from('products')
          .insert({ name: prodName, store_id: currentStoreId, category_id: categoryId || null })
          .select('id, name')
          .single()
        if (newProd) productMap.set(newProd.name.toLowerCase(), newProd.id)
      }

      // 3. Process each row: create/find variant, update inventory
      let successCount = 0
      let errorCount = 0

      for (const row of validRows) {
        try {
          const productId = productMap.get(row.product_name.toLowerCase())
          if (!productId) { errorCount++; continue }

          // Find or create variant
          let variantId: number | null = null

          // Try to find by product_id + variant name
          const { data: existingVariant } = await supabase
            .from('variants')
            .select('id')
            .eq('product_id', productId)
            .eq('name', row.variant_name)
            .eq('store_id', currentStoreId)
            .maybeSingle()

          if (existingVariant) {
            variantId = existingVariant.id
            // Update prices
            await supabase
              .from('variants')
              .update({
                cost_price: row.cost_price,
                price: row.selling_price,
                ...(row.sku ? { sku: row.sku } : {})
              })
              .eq('id', variantId)
          } else {
            // Create new variant
            const { data: newVariant } = await supabase
              .from('variants')
              .insert({
                name: row.variant_name,
                product_id: productId,
                store_id: currentStoreId,
                cost_price: row.cost_price,
                price: row.selling_price,
                sku: row.sku || null
              })
              .select('id')
              .single()
            if (newVariant) variantId = newVariant.id
          }

          if (!variantId) { errorCount++; continue }

          // Update or create inventory
          const { data: existingInv } = await supabase
            .from('inventory')
            .select('id, quantity')
            .eq('variant_id', variantId)
            .eq('store_id', currentStoreId)
            .maybeSingle()

          if (existingInv) {
            await supabase
              .from('inventory')
              .update({ quantity: existingInv.quantity + row.quantity })
              .eq('id', existingInv.id)
          } else {
            await supabase
              .from('inventory')
              .insert({ variant_id: variantId, quantity: row.quantity, store_id: currentStoreId })
          }

          // Record stock movement
          if (row.quantity > 0) {
            await supabase.from('stock_movements').insert({
              variant_id: variantId,
              quantity: row.quantity,
              movement: 'in',
              created_by: user?.id,
              store_id: currentStoreId
            })
          }

          successCount++
        } catch {
          errorCount++
        }
      }

      toast({
        title: "Berhasil",
        description: `${successCount} item berhasil diproses${errorCount > 0 ? `, ${errorCount} gagal` : ''}`,
      })

      onSuccess()
      onOpenChange(false)
      resetForm()
    } catch (error) {
      console.error('Error uploading stock:', error)
      toast({
        title: "Error",
        description: "Gagal memproses data stok",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  const downloadTemplate = () => {
    const templateData = [
      { 'Nama Produk': 'Kaos Polos', 'Kategori': 'Pakaian', 'Varian': 'Hitam - L', 'SKU': 'KP-HTM-L', 'Jumlah': 100, 'Harga Beli': 35000, 'Harga Jual': 75000 },
      { 'Nama Produk': 'Kaos Polos', 'Kategori': 'Pakaian', 'Varian': 'Putih - M', 'SKU': 'KP-PTH-M', 'Jumlah': 50, 'Harga Beli': 35000, 'Harga Jual': 75000 },
      { 'Nama Produk': 'Celana Jeans', 'Kategori': 'Pakaian', 'Varian': 'Biru - 32', 'SKU': 'CJ-BLU-32', 'Jumlah': 30, 'Harga Beli': 80000, 'Harga Jual': 150000 },
    ]

    const ws = XLSX.utils.json_to_sheet(templateData)

    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, // Nama Produk
      { wch: 15 }, // Kategori
      { wch: 15 }, // Varian
      { wch: 12 }, // SKU
      { wch: 10 }, // Jumlah
      { wch: 12 }, // Harga Beli
      { wch: 12 }, // Harga Jual
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, 'template_upload_stok.xlsx')
  }

  const validCount = uploadedData.filter(r => r.status === 'valid').length
  const invalidCount = uploadedData.filter(r => r.status === 'invalid').length

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm()
      onOpenChange(open)
    }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload Stok via Excel</DialogTitle>
          <DialogDescription>
            Upload file Excel dengan kolom Nama Produk, Kategori, Varian, SKU, Jumlah, Harga Beli, dan Harga Jual. Produk & varian baru akan otomatis dibuat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {uploadedData.length === 0 ? (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {processing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-muted-foreground">Memproses file...</p>
                  </div>
                ) : (
                  <>
                    <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-foreground mb-2">
                      Klik atau drag file Excel ke sini
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Format: .xlsx atau .xls
                    </p>
                  </>
                )}
              </div>

              <Button variant="outline" onClick={downloadTemplate} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Download Template Excel
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <span className="font-medium">{fileName}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  Ganti File
                </Button>
              </div>

              <div className="flex gap-4">
                <Badge variant="default" className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {validCount} Valid
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {invalidCount} Invalid
                  </Badge>
                )}
              </div>

              <ScrollArea className="flex-1 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Produk</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Varian</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead className="text-right">Harga Beli</TableHead>
                      <TableHead className="text-right">Harga Jual</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadedData.slice(0, 100).map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row.product_name || '-'}</TableCell>
                        <TableCell>{row.category_name || '-'}</TableCell>
                        <TableCell>{row.variant_name || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">{row.sku || '-'}</TableCell>
                        <TableCell className="text-right">{row.quantity}</TableCell>
                        <TableCell className="text-right">{row.cost_price.toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-right">{row.selling_price.toLocaleString('id-ID')}</TableCell>
                        <TableCell>
                          {row.status === 'valid' ? (
                            <Badge variant="default" className="bg-success">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Valid
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {row.message}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {uploadedData.length > 100 && (
                  <p className="text-center text-muted-foreground py-2 text-sm">
                    Menampilkan 100 dari {uploadedData.length} baris
                  </p>
                )}
              </ScrollArea>
            </>
          )}
        </div>

        {uploadedData.length > 0 && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={uploading || validCount === 0}
              className="bg-gradient-primary"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload {validCount} Item
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

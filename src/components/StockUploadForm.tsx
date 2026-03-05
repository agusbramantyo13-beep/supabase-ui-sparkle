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
  sku: string
  quantity: number
  variant_id?: number
  variant_name?: string
  product_name?: string
  status: 'valid' | 'invalid' | 'not_found'
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

      // Validate and fetch variant data
      const skus = jsonData.map(row => row.SKU || row.sku || '').filter(Boolean)
      
      // Fetch all variants with their SKUs
      let variantQuery = supabase
        .from('variants')
        .select(`
          id,
          sku,
          name,
          products(name)
        `)
        .in('sku', skus)
      if (currentStoreId) variantQuery = variantQuery.eq('store_id', currentStoreId)
      const { data: variants } = await variantQuery

      const variantMap = new Map(
        (variants || []).map(v => [v.sku, {
          id: v.id,
          name: v.name,
          product_name: (v.products as any)?.name || 'Unknown'
        }])
      )

      // Process each row
      const processedData: UploadRow[] = jsonData.map(row => {
        const sku = String(row.SKU || row.sku || '').trim()
        const quantity = parseInt(row.Quantity || row.quantity || row.Jumlah || row.jumlah || '0')

        if (!sku) {
          return {
            sku: '',
            quantity,
            status: 'invalid' as const,
            message: 'SKU tidak boleh kosong'
          }
        }

        if (isNaN(quantity) || quantity < 0) {
          return {
            sku,
            quantity: 0,
            status: 'invalid' as const,
            message: 'Jumlah tidak valid'
          }
        }

        const variantInfo = variantMap.get(sku)
        if (!variantInfo) {
          return {
            sku,
            quantity,
            status: 'not_found' as const,
            message: 'SKU tidak ditemukan'
          }
        }

        return {
          sku,
          quantity,
          variant_id: variantInfo.id,
          variant_name: variantInfo.name,
          product_name: variantInfo.product_name,
          status: 'valid' as const
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
      
      // Process in batches of 100
      const batchSize = 100
      let successCount = 0
      let errorCount = 0

      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize)
        
        for (const row of batch) {
          if (!row.variant_id) continue

          // Check if inventory exists
          let invQuery = supabase
            .from('inventory')
            .select('id, quantity')
            .eq('variant_id', row.variant_id)
          if (currentStoreId) invQuery = invQuery.eq('store_id', currentStoreId)
          const { data: existingInventory } = await invQuery.maybeSingle()

          if (existingInventory) {
            // Update existing inventory
            const { error: updateError } = await supabase
              .from('inventory')
              .update({ 
                quantity: existingInventory.quantity + row.quantity,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingInventory.id)

            if (updateError) {
              errorCount++
              continue
            }
          } else {
            // Insert new inventory
            const { error: insertError } = await supabase
              .from('inventory')
              .insert({
                variant_id: row.variant_id,
                quantity: row.quantity,
                store_id: currentStoreId
              })

            if (insertError) {
              errorCount++
              continue
            }
          }

          // Record stock movement
          await supabase.from('stock_movements').insert({
            variant_id: row.variant_id,
            quantity: row.quantity,
            movement: 'in',
            created_by: user?.id,
            store_id: currentStoreId
          })

          successCount++
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
      { SKU: 'SKU001', Jumlah: 100 },
      { SKU: 'SKU002', Jumlah: 50 },
    ]

    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, 'template_upload_stok.xlsx')
  }

  const validCount = uploadedData.filter(r => r.status === 'valid').length
  const invalidCount = uploadedData.filter(r => r.status === 'invalid').length
  const notFoundCount = uploadedData.filter(r => r.status === 'not_found').length

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm()
      onOpenChange(open)
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload Stok via Excel</DialogTitle>
          <DialogDescription>
            Upload file Excel dengan kolom SKU dan Jumlah untuk menambah stok massal
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Upload Area */}
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
              {/* File Info */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <span className="font-medium">{fileName}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  Ganti File
                </Button>
              </div>

              {/* Summary */}
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
                {notFoundCount > 0 && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {notFoundCount} SKU Tidak Ditemukan
                  </Badge>
                )}
              </div>

              {/* Data Preview */}
              <ScrollArea className="flex-1 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Produk</TableHead>
                      <TableHead>Varian</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadedData.slice(0, 100).map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">{row.sku || '-'}</TableCell>
                        <TableCell>{row.product_name || '-'}</TableCell>
                        <TableCell>{row.variant_name || '-'}</TableCell>
                        <TableCell className="text-right">{row.quantity}</TableCell>
                        <TableCell>
                          {row.status === 'valid' ? (
                            <Badge variant="default" className="bg-success">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Valid
                            </Badge>
                          ) : row.status === 'not_found' ? (
                            <Badge variant="secondary">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Tidak Ditemukan
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

        {/* Footer */}
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

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/contexts/StoreContext";
import { applyInventoryChange } from "@/lib/stockHistory";

const formatPriceInput = (value: string): string => {
  const num = value.replace(/\D/g, "");
  if (!num) return "";
  return new Intl.NumberFormat("id-ID").format(parseInt(num));
};

const parsePriceInput = (value: string): string => value.replace(/\D/g, "");

interface VariantRow {
  name: string;
  price: string;
  cost_price: string;
  sku: string;
  initial_quantity: string;
}

const emptyVariant = (): VariantRow => ({
  name: "",
  price: "",
  cost_price: "",
  sku: "",
  initial_quantity: "",
});

interface AddVariantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  productId: number | null;
  productName: string;
}

export function AddVariantDialog({ open, onOpenChange, onSuccess, productId, productName }: AddVariantDialogProps) {
  const [variants, setVariants] = useState<VariantRow[]>([emptyVariant()]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { currentStoreId } = useStore();

  useEffect(() => {
    if (open) setVariants([emptyVariant()]);
  }, [open]);

  const updateVariant = (index: number, field: keyof VariantRow, value: string) => {
    setVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };

  const addVariant = () => setVariants(prev => [...prev, emptyVariant()]);
  const removeVariant = (index: number) => {
    if (variants.length <= 1) return;
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) return;

    const validVariants = variants.filter(v => v.name && v.price);
    if (validVariants.length === 0) {
      toast({ title: "Gagal", description: "Minimal 1 varian harus diisi (nama & harga)", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      for (const v of validVariants) {
        const initialQty = v.initial_quantity ? parseInt(v.initial_quantity) : 0;
        const costPrice = v.cost_price ? parseFloat(v.cost_price) : 0;
        const { data: variantData, error: variantError } = await supabase
          .from('variants')
          .insert({
            product_id: productId,
            name: v.name,
            price: parseFloat(v.price),
            cost_price: costPrice,
            ...(initialQty > 0 ? { average_cost: costPrice } : {}),
            sku: v.sku || null,
            store_id: currentStoreId
          } as any)
          .select()
          .single();
        if (variantError) throw variantError;

        if (initialQty > 0) {
          await applyInventoryChange({
            variantId: variantData.id,
            newQuantity: initialQty,
            type: 'initial_stock',
            notes: 'Stok awal varian baru',
          });
        }
      }

      // Bump product to "has_variants" once an extra variant is attached
      await supabase
        .from('products')
        .update({ has_variants: true } as any)
        .eq('id', productId);

      toast({ title: "Berhasil", description: `${validVariants.length} varian berhasil ditambahkan` });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message || "Gagal menambahkan varian", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Tambah Varian</DialogTitle>
          <DialogDescription>
            Tambahkan varian baru untuk produk <span className="font-semibold text-foreground">{productName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 min-h-0">
          <form onSubmit={handleSubmit} className="space-y-4 pb-2" id="add-variant-form">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Varian Baru</Label>
                <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                  <Plus className="w-3 h-3 mr-1" />
                  Tambah Varian
                </Button>
              </div>

              {variants.map((variant, index) => (
                <div key={index} className="border border-border rounded-lg p-3 space-y-3 relative">
                  {variants.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => removeVariant(index)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}

                  <div className="text-xs font-medium text-muted-foreground">Varian {index + 1}</div>

                  <div>
                    <Label>Nama Varian *</Label>
                    <Input
                      value={variant.name}
                      onChange={(e) => updateVariant(index, 'name', e.target.value)}
                      placeholder="cth: 9mg, Besar, XL"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Harga Jual *</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatPriceInput(variant.price)}
                        onChange={(e) => updateVariant(index, 'price', parsePriceInput(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label>Harga Modal</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatPriceInput(variant.cost_price)}
                        onChange={(e) => updateVariant(index, 'cost_price', parsePriceInput(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>SKU</Label>
                      <Input
                        value={variant.sku}
                        onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                        placeholder="Kode SKU"
                      />
                    </div>
                    <div>
                      <Label>Stok Awal</Label>
                      <Input
                        type="number"
                        min="0"
                        value={variant.initial_quantity}
                        onChange={(e) => updateVariant(index, 'initial_quantity', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </form>
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Batal
          </Button>
          <Button type="submit" form="add-variant-form" disabled={loading} className="flex-1 bg-gradient-primary">
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

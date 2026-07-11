import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/contexts/StoreContext";
import { Plus, Trash2, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyInventoryChange } from "@/lib/stockHistory";

interface ProductVariant {
  id: string;
  name: string;
  product_name: string;
  cost_price: number;
  current_quantity: number;
}

interface AdjustmentItem {
  variant_id: string;
  old_quantity: number;
  new_quantity: number;
  unit_value: number;
  open: boolean;
  search: string;
}

interface StockAdjustmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function StockAdjustmentForm({ open, onOpenChange, onSuccess }: StockAdjustmentFormProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [items, setItems] = useState<AdjustmentItem[]>([
    { variant_id: "", old_quantity: 0, new_quantity: 0, unit_value: 0, open: false, search: "" }
  ]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { currentStoreId } = useStore();

  useEffect(() => {
    if (open) {
      fetchVariants();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setItems([{ variant_id: "", old_quantity: 0, new_quantity: 0, unit_value: 0, open: false, search: "" }]);
      setNote("");
    }
  }, [open]);

  const fetchVariants = async () => {
    const { data, error } = await supabase
      .from('variants')
      .select(`
        id,
        name,
        cost_price,
        products!inner(name)
      `)
      .eq('store_id', currentStoreId)
      .order('name');

    if (error) {
      toast({
        title: "Error",
        description: "Gagal memuat data produk",
        variant: "destructive"
      });
      return;
    }

    const formattedVariants = data?.map(variant => ({
      id: variant.id.toString(),
      name: variant.name,
      product_name: variant.products.name,
      cost_price: variant.cost_price,
      current_quantity: 0
    })) || [];

    setVariants(formattedVariants);
  };

  const handleVariantChange = async (index: number, variantId: string) => {
    const variant = variants.find(v => v.id === variantId);
    if (!variant) return;

    const { data: inventory } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('variant_id', parseInt(variantId))
      .maybeSingle();

    const currentQty = inventory?.quantity || 0;

    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      variant_id: variantId,
      old_quantity: currentQty,
      new_quantity: currentQty,
      unit_value: variant.cost_price,
      open: false,
      search: ""
    };
    setItems(newItems);
  };

  const handleNewQuantityChange = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index].new_quantity = parseFloat(value) || 0;
    setItems(newItems);
  };

  const updateItemField = (index: number, field: keyof AdjustmentItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { variant_id: "", old_quantity: 0, new_quantity: 0, unit_value: 0, open: false, search: "" }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateTotalValueDifference = () => {
    return items.reduce((total, item) => {
      const qtyDiff = item.new_quantity - item.old_quantity;
      const valueDiff = qtyDiff * item.unit_value;
      return total + valueDiff;
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = items.filter(item => item.variant_id && item.new_quantity >= 0);
    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "Tambahkan minimal satu item untuk disesuaikan",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: session, error: sessionError } = await supabase
        .from('stock_adjustment_sessions')
        .insert({
          created_by: user?.id,
          note,
          total_value_difference: calculateTotalValueDifference(),
          status: 'completed',
          store_id: currentStoreId
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      for (const item of validItems) {
        const qtyDiff = item.new_quantity - item.old_quantity;
        const valueDiff = qtyDiff * item.unit_value;

        const { error: itemError } = await supabase
          .from('stock_adjustment_items')
          .insert({
            session_id: session.id,
            variant_id: parseInt(item.variant_id),
            old_quantity: item.old_quantity,
            new_quantity: item.new_quantity,
            quantity_difference: qtyDiff,
            unit_value: item.unit_value,
            total_value_difference: valueDiff
          });

        if (itemError) throw itemError;

        await applyInventoryChange({
          variantId: parseInt(item.variant_id),
          newQuantity: item.new_quantity,
          type: 'stock_adjustment',
          notes: note || null,
        });
      }

      toast({
        title: "Berhasil",
        description: `Penyesuaian stok berhasil disimpan. Selisih nilai: Rp ${calculateTotalValueDifference().toLocaleString('id-ID')}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal menyimpan penyesuaian stok",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Penyesuaian Stok Multi-Item</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            {items.map((item, index) => {
              const selectedVariant = variants.find(v => v.id === item.variant_id);
              const filtered = variants.filter(v =>
                v.product_name.toLowerCase().includes(item.search.toLowerCase()) ||
                v.name.toLowerCase().includes(item.search.toLowerCase())
              );

              return (
                <div key={index} className="border rounded-lg p-4 space-y-3 bg-muted/50">
                  <div className="flex justify-between items-center">
                    <Label className="font-semibold">Item #{index + 1}</Label>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Produk Varian *</Label>
                      <Popover open={item.open} onOpenChange={(open) => updateItemField(index, 'open', open)}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={item.open}
                            className="w-full justify-between"
                          >
                            {selectedVariant
                              ? `${selectedVariant.product_name} - ${selectedVariant.name}`
                              : "Pilih produk varian"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <div className="p-2 border-b">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="Cari produk..."
                                value={item.search}
                                onChange={(e) => updateItemField(index, 'search', e.target.value)}
                                className="pl-8 h-9"
                                autoComplete="off"
                              />
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto">
                            {filtered.length > 0 ? (
                              filtered.map((variant) => (
                                <button
                                  key={variant.id}
                                  type="button"
                                  onClick={() => handleVariantChange(index, variant.id)}
                                  className={cn(
                                    "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                                    item.variant_id === variant.id && "bg-accent text-accent-foreground"
                                  )}
                                >
                                  {variant.product_name} - {variant.name}
                                </button>
                              ))
                            ) : (
                              <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                                Tidak ada produk ditemukan
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <Label>Stok Lama</Label>
                      <Input
                        type="number"
                        value={item.old_quantity}
                        disabled
                        className="bg-muted"
                      />
                    </div>

                    <div>
                      <Label>Stok Baru *</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.new_quantity}
                        onChange={(e) => handleNewQuantityChange(index, e.target.value)}
                        placeholder="Masukkan stok baru"
                      />
                    </div>

                    <div>
                      <Label>Nilai Satuan</Label>
                      <Input
                        type="number"
                        value={item.unit_value}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-2 bg-background rounded border">
                      <span className="text-muted-foreground">Selisih Qty:</span>
                      <span className={`ml-2 font-semibold ${(item.new_quantity - item.old_quantity) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(item.new_quantity - item.old_quantity) >= 0 ? '+' : ''}{(item.new_quantity - item.old_quantity).toFixed(2)}
                      </span>
                    </div>
                    <div className="p-2 bg-background rounded border">
                      <span className="text-muted-foreground">Selisih Nilai:</span>
                      <span className={`ml-2 font-semibold ${((item.new_quantity - item.old_quantity) * item.unit_value) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {((item.new_quantity - item.old_quantity) * item.unit_value) >= 0 ? '+' : ''}Rp {((item.new_quantity - item.old_quantity) * item.unit_value).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={addItem}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Tambah Item
          </Button>

          <div>
            <Label htmlFor="note">Catatan</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tambahkan catatan untuk penyesuaian ini..."
              rows={3}
            />
          </div>

          <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total Selisih Nilai:</span>
              <span className={`text-xl font-bold ${calculateTotalValueDifference() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {calculateTotalValueDifference() >= 0 ? '+' : ''}Rp {calculateTotalValueDifference().toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-gradient-primary">
              {loading ? "Menyimpan..." : "Simpan Penyesuaian"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

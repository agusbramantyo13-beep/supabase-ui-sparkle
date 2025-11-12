import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ProductVariant {
  id: string;
  name: string;
  product_name: string;
  price: number;
  cost_price: number;
}

interface StockItem {
  variant_id: string;
  variant_name: string;
  quantity: number;
  cost_price: number;
  selling_price: number;
  total_cost: number;
}

interface StockPurchaseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function StockPurchaseForm({ open, onOpenChange, onSuccess }: StockPurchaseFormProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [supplier, setSupplier] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<StockItem[]>([{
    variant_id: "",
    variant_name: "",
    quantity: 0,
    cost_price: 0,
    selling_price: 0,
    total_cost: 0
  }]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchVariants();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setSupplier("");
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setNotes("");
    setItems([{
      variant_id: "",
      variant_name: "",
      quantity: 0,
      cost_price: 0,
      selling_price: 0,
      total_cost: 0
    }]);
  };

  const fetchVariants = async () => {
    const { data, error } = await supabase
      .from('variants')
      .select(`
        id,
        name,
        price,
        cost_price,
        products!inner(name)
      `)
      .order('name');

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load product variants",
        variant: "destructive"
      });
      return;
    }

    const formattedVariants = data?.map(variant => ({
      id: variant.id.toString(),
      name: variant.name,
      product_name: variant.products.name,
      price: variant.price,
      cost_price: variant.cost_price
    })) || [];

    setVariants(formattedVariants);
  };

  const addItem = () => {
    setItems([...items, {
      variant_id: "",
      variant_name: "",
      quantity: 0,
      cost_price: 0,
      selling_price: 0,
      total_cost: 0
    }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof StockItem, value: string | number) => {
    const newItems = [...items];
    
    if (field === 'variant_id' && typeof value === 'string') {
      const variant = variants.find(v => v.id === value);
      if (variant) {
        newItems[index] = {
          ...newItems[index],
          variant_id: value,
          variant_name: `${variant.product_name} - ${variant.name}`,
          cost_price: variant.cost_price,
          selling_price: variant.price
        };
      }
    } else if (field === 'quantity' || field === 'cost_price' || field === 'selling_price' || field === 'total_cost') {
      newItems[index][field] = typeof value === 'number' ? value : 0;
    } else if (field === 'variant_name') {
      newItems[index][field] = typeof value === 'string' ? value : '';
    }

    // Recalculate total cost
    if (field === 'quantity' || field === 'cost_price') {
      newItems[index].total_cost = newItems[index].quantity * newItems[index].cost_price;
    }

    setItems(newItems);
  };

  const getTotals = () => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalProducts = items.filter(item => item.variant_id).length;
    const totalCost = items.reduce((sum, item) => sum + item.total_cost, 0);
    return { totalItems, totalProducts, totalCost };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplier.trim()) {
      toast({
        title: "Error",
        description: "Supplier harus diisi",
        variant: "destructive"
      });
      return;
    }

    const validItems = items.filter(item => item.variant_id && item.quantity > 0);
    
    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "Tambahkan minimal 1 produk",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Update inventory and create stock movements for each item
      for (const item of validItems) {
        // Get current inventory
        const { data: currentInventory } = await supabase
          .from('inventory')
          .select('id, quantity')
          .eq('variant_id', parseInt(item.variant_id))
          .maybeSingle();

        if (currentInventory) {
          // Update existing inventory
          const newQuantity = currentInventory.quantity + item.quantity;
          const { error: inventoryError } = await supabase
            .from('inventory')
            .update({ quantity: newQuantity })
            .eq('id', currentInventory.id);

          if (inventoryError) throw inventoryError;
        } else {
          // Insert new inventory record
          const { error: inventoryError } = await supabase
            .from('inventory')
            .insert({
              variant_id: parseInt(item.variant_id),
              quantity: item.quantity
            });

          if (inventoryError) throw inventoryError;
        }

        // Update variant prices if changed
        const { error: variantError } = await supabase
          .from('variants')
          .update({
            cost_price: item.cost_price,
            price: item.selling_price
          })
          .eq('id', parseInt(item.variant_id));

        if (variantError) throw variantError;

        // Create stock movement record
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert({
            variant_id: parseInt(item.variant_id),
            movement: 'in',
            quantity: item.quantity,
            created_by: (await supabase.auth.getUser()).data.user?.id || null
          });

        if (movementError) throw movementError;
      }

      const totals = getTotals();
      
      toast({
        title: "Berhasil",
        description: `Stok berhasil ditambahkan. Total: ${totals.totalItems} item, ${totals.totalProducts} produk, Rp ${totals.totalCost.toLocaleString('id-ID')}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal menambahkan stok",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const totals = getTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Input Stok Pembelian</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supplier">Supplier *</Label>
              <Input
                id="supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Nama supplier"
              />
            </div>

            <div>
              <Label htmlFor="date">Tanggal Pembelian *</Label>
              <Input
                id="date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Item Pembelian</Label>
            <div className="space-y-3 mt-2">
              {items.map((item, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-4">
                        <Label className="text-xs">Produk</Label>
                        <Select 
                          value={item.variant_id} 
                          onValueChange={(value) => updateItem(index, 'variant_id', value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Pilih produk" />
                          </SelectTrigger>
                          <SelectContent>
                            {variants.map((variant) => (
                              <SelectItem key={variant.id} value={variant.id}>
                                {variant.product_name} - {variant.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-2">
                        <Label className="text-xs">Jumlah</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity || ""}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="h-9"
                        />
                      </div>

                      <div className="col-span-2">
                        <Label className="text-xs">Harga Beli</Label>
                        <Input
                          type="number"
                          min="0"
                          value={item.cost_price || ""}
                          onChange={(e) => updateItem(index, 'cost_price', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="h-9"
                        />
                      </div>

                      <div className="col-span-2">
                        <Label className="text-xs">Harga Jual</Label>
                        <Input
                          type="number"
                          min="0"
                          value={item.selling_price || ""}
                          onChange={(e) => updateItem(index, 'selling_price', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="h-9"
                        />
                      </div>

                      <div className="col-span-1 flex items-end">
                        <Label className="text-xs mb-2 block w-full">
                          Total: <br/>
                          <span className="font-semibold">
                            {item.total_cost.toLocaleString('id-ID')}
                          </span>
                        </Label>
                      </div>

                      <div className="col-span-1 flex items-end justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          disabled={items.length === 1}
                          className="h-9 w-9"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={addItem}
              className="mt-3 w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah Item
            </Button>
          </div>

          <div>
            <Label htmlFor="notes">Catatan (Opsional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan pembelian..."
              rows={2}
            />
          </div>

          <Card className="bg-muted">
            <CardContent className="pt-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-sm text-muted-foreground">Total Item</div>
                  <div className="text-2xl font-bold">{totals.totalItems}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Produk</div>
                  <div className="text-2xl font-bold">{totals.totalProducts}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Modal</div>
                  <div className="text-2xl font-bold">
                    Rp {totals.totalCost.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Memproses..." : "Simpan Pembelian"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

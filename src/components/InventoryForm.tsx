import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/contexts/StoreContext";

interface ProductVariant {
  id: string;
  name: string;
  product_name: string;
}

interface InventoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  type: 'add' | 'remove' | 'adjust';
}

export function InventoryForm({ open, onOpenChange, onSuccess, type }: InventoryFormProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    variant_id: "",
    quantity: "",
    reason: ""
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { currentStoreId } = useStore();

  const filteredVariants = variants.filter(v =>
    v.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (open) {
      fetchVariants();
    }
  }, [open]);

  useEffect(() => {
    setFormData({
      variant_id: "",
      quantity: "",
      reason: ""
    });
  }, [open]);

  const fetchVariants = async () => {
    const { data, error } = await supabase
      .from('variants')
      .select(`
        id,
        name,
        products!inner(name)
      `)
      .eq('store_id', currentStoreId)
      .order('name');

    if (error) {
      toast({
        title: "Gagal",
        description: "Gagal memuat varian produk",
        variant: "destructive"
      });
      return;
    }

    const formattedVariants = data?.map(variant => ({
      id: variant.id.toString(),
      name: variant.name,
      product_name: variant.products.name
    })) || [];

    setVariants(formattedVariants);
  };

  const getMovementType = () => {
    switch (type) {
      case 'add': return 'in';
      case 'remove': return 'out';
      case 'adjust': return 'in';
      default: return 'in';
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'add': return 'Tambah Inventori';
      case 'remove': return 'Kurangi Inventori';
      case 'adjust': return 'Sesuaikan Inventori';
      default: return 'Pergerakan Inventori';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.variant_id || !formData.quantity) {
      toast({
        title: "Gagal",
        description: "Harap isi semua field yang wajib",
        variant: "destructive"
      });
      return;
    }

    const quantity = parseInt(formData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast({
        title: "Gagal",
        description: "Masukkan jumlah yang valid",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data: currentInventory } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('variant_id', parseInt(formData.variant_id))
        .maybeSingle();

      const currentQty = currentInventory?.quantity || 0;
      let newQuantity = currentQty;

      switch (type) {
        case 'add':
          newQuantity = currentQty + quantity;
          break;
        case 'remove':
          newQuantity = Math.max(0, currentQty - quantity);
          break;
        case 'adjust':
          newQuantity = quantity;
          break;
      }

      if (currentInventory) {
        const { error: inventoryError } = await supabase
          .from('inventory')
          .update({ quantity: newQuantity })
          .eq('id', currentInventory.id);
        if (inventoryError) throw inventoryError;
      } else {
        const { error: inventoryError } = await supabase
          .from('inventory')
          .insert({
            variant_id: parseInt(formData.variant_id),
            quantity: newQuantity,
            store_id: currentStoreId
          });
        if (inventoryError) throw inventoryError;
      }

      const actualQuantityChange = type === 'remove' ? -quantity : 
                                  type === 'adjust' ? (newQuantity - currentQty) : 
                                  quantity;

      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          variant_id: parseInt(formData.variant_id),
          movement: getMovementType(),
          quantity: Math.abs(actualQuantityChange),
          created_by: null,
          store_id: currentStoreId
        });

      if (movementError) throw movementError;

      toast({
        title: "Berhasil",
        description: `Inventori berhasil ${type === 'add' ? 'ditambahkan' : type === 'remove' ? 'dikurangi' : 'disesuaikan'}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Gagal",
        description: error.message || "Gagal memperbarui inventori",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="variant">Varian Produk *</Label>
            <Select 
              value={formData.variant_id} 
              onValueChange={(value) => setFormData({ ...formData, variant_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih varian produk" />
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

          <div>
            <Label htmlFor="quantity">
              {type === 'adjust' ? 'Jumlah Baru' : 'Jumlah'} *
            </Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              placeholder="Masukkan jumlah"
            />
          </div>

          <div>
            <Label htmlFor="reason">Alasan (Opsional)</Label>
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Masukkan alasan perubahan inventori..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-gradient-primary">
              {loading ? "Memproses..." : "Konfirmasi"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
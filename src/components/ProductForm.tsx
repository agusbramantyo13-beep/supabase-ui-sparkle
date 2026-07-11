import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Check, ChevronsUpDown, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/contexts/StoreContext";
import { applyInventoryChange } from "@/lib/stockHistory";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const formatPriceInput = (value: string): string => {
  const num = value.replace(/\D/g, "");
  if (!num) return "";
  return new Intl.NumberFormat("id-ID").format(parseInt(num));
};

const parsePriceInput = (value: string): string => {
  return value.replace(/\D/g, "");
};

interface Category {
  id: number;
  name: string;
}

interface VariantRow {
  id?: number;
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

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  product?: any;
}

export function ProductForm({ open, onOpenChange, onSuccess, product }: ProductFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [productName, setProductName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [variants, setVariants] = useState<VariantRow[]>([emptyVariant()]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { currentStoreId } = useStore();

  const isEditMode = !!product?.variant_id;

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (product) {
      setProductName(product.name || "");
      setCategoryId(product.category_id?.toString() || "");
      if (product.category_name) setCategorySearch(product.category_name);
      setVariants([{
        id: product.variant_id,
        name: product.variant_name || "",
        price: product.variant_price?.toString() || "",
        cost_price: product.variant_cost_price?.toString() || "",
        sku: product.variant_sku || "",
        initial_quantity: product.quantity?.toString() || "",
      }]);
    } else {
      setProductName("");
      setCategoryId("");
      setCategorySearch("");
      setVariants([emptyVariant()]);
    }
  }, [product, open]);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('store_id', currentStoreId)
      .order('name');
    setCategories(data || []);
  };

  const selectedCategory = categories.find(c => c.id.toString() === categoryId);
  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );
  const exactMatch = categories.some(c => c.name.toLowerCase() === categorySearch.trim().toLowerCase());

  const handleCreateCategory = async () => {
    const name = categorySearch.trim();
    if (!name) return;
    setCreatingCategory(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({ name, store_id: currentStoreId })
        .select()
        .single();
      if (error) throw error;
      await fetchCategories();
      setCategoryId(data.id.toString());
      setCategorySearch(data.name);
      setCategoryPopoverOpen(false);
      toast({ title: "Berhasil", description: `Kategori "${name}" berhasil ditambahkan` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleSelectCategory = (cat: Category) => {
    setCategoryId(cat.id.toString());
    setCategorySearch(cat.name);
    setCategoryPopoverOpen(false);
  };

  const updateVariant = (index: number, field: keyof VariantRow, value: string) => {
    setVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };

  const addVariant = () => {
    setVariants(prev => [...prev, emptyVariant()]);
  };

  const removeVariant = (index: number) => {
    if (variants.length <= 1) return;
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productName || !categoryId) {
      toast({ title: "Error", description: "Nama produk dan kategori wajib diisi", variant: "destructive" });
      return;
    }

    const validVariants = variants.filter(v => v.name && v.price);
    if (validVariants.length === 0) {
      toast({ title: "Error", description: "Minimal 1 varian harus diisi (nama & harga)", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      if (isEditMode) {
        // Edit mode: update product + single variant
        const { error: productError } = await supabase
          .from('products')
          .update({ name: productName, category_id: parseInt(categoryId) })
          .eq('id', product.id);
        if (productError) throw productError;

        const v = variants[0];
        const { error: variantError } = await supabase
          .from('variants')
          .update({
            name: v.name,
            price: parseFloat(v.price),
            cost_price: v.cost_price ? parseFloat(v.cost_price) : 0,
            sku: v.sku || null
          })
          .eq('id', product.variant_id);
        if (variantError) throw variantError;

        toast({ title: "Berhasil", description: "Produk berhasil diperbarui" });
      } else {
        // Create mode: create product + multiple variants
        const { data: productData, error: productError } = await supabase
          .from('products')
          .insert({ name: productName, category_id: parseInt(categoryId), store_id: currentStoreId })
          .select()
          .single();
        if (productError) throw productError;

        for (const v of validVariants) {
          const { data: variantData, error: variantError } = await supabase
            .from('variants')
            .insert({
              product_id: productData.id,
              name: v.name,
              price: parseFloat(v.price),
              cost_price: v.cost_price ? parseFloat(v.cost_price) : 0,
              sku: v.sku || null,
              store_id: currentStoreId
            })
            .select()
            .single();
          if (variantError) throw variantError;

          if (v.initial_quantity && parseInt(v.initial_quantity) > 0) {
            await applyInventoryChange({
              variantId: variantData.id,
              newQuantity: parseInt(v.initial_quantity),
              type: 'initial_stock',
              notes: 'Stok awal produk baru',
            });
          }
        }

        toast({ title: "Berhasil", description: `Produk dengan ${validVariants.length} varian berhasil ditambahkan` });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Gagal menyimpan produk", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{isEditMode ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 min-h-0">
          <form onSubmit={handleSubmit} className="space-y-4 pb-2" id="product-form">
            {/* Product Name */}
            <div>
              <Label htmlFor="name">Nama Produk *</Label>
              <Input
                id="name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Masukkan nama produk"
              />
            </div>

            {/* Category */}
            <div>
              <Label>Kategori *</Label>
              <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={categoryPopoverOpen}
                    className="w-full justify-between font-normal"
                    type="button"
                  >
                    {selectedCategory ? selectedCategory.name : "Pilih atau ketik kategori baru..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <div className="p-2">
                    <Input
                      placeholder="Cari atau ketik kategori baru..."
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredCategories.length > 0 ? (
                      filteredCategories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          className={cn(
                            "flex items-center w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                            categoryId === cat.id.toString() && "bg-accent"
                          )}
                          onClick={() => handleSelectCategory(cat)}
                        >
                          <Check
                            className={cn("mr-2 h-4 w-4", categoryId === cat.id.toString() ? "opacity-100" : "opacity-0")}
                          />
                          {cat.name}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Tidak ada kategori ditemukan</div>
                    )}
                  </div>
                  {categorySearch.trim() && !exactMatch && (
                    <div className="border-t border-border p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-primary"
                        onClick={handleCreateCategory}
                        disabled={creatingCategory}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {creatingCategory ? "Membuat..." : `Buat kategori "${categorySearch.trim()}"`}
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Variants */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Varian</Label>
                {!isEditMode && (
                  <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                    <Plus className="w-3 h-3 mr-1" />
                    Tambah Varian
                  </Button>
                )}
              </div>

              {variants.map((variant, index) => (
                <div key={index} className="border border-border rounded-lg p-3 space-y-3 relative">
                  {variants.length > 1 && !isEditMode && (
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
                      placeholder="cth: Default, Kecil, Besar"
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
                    {!isEditMode && (
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
                    )}
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
          <Button type="submit" form="product-form" disabled={loading} className="flex-1 bg-gradient-primary">
            {loading ? "Menyimpan..." : isEditMode ? "Perbarui" : "Simpan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

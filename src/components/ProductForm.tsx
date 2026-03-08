import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/contexts/StoreContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Category {
  id: number;
  name: string;
}

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
  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    variant_name: "",
    variant_price: "",
    variant_cost_price: "",
    variant_sku: "",
    initial_quantity: ""
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { currentStoreId } = useStore();

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        category_id: product.category_id?.toString() || "",
        variant_name: product.variant_name || "",
        variant_price: product.variant_price?.toString() || "",
        variant_cost_price: product.variant_cost_price?.toString() || "",
        variant_sku: product.variant_sku || "",
        initial_quantity: product.quantity?.toString() || ""
      });
      // Set search text to current category name
      if (product.category_name) {
        setCategorySearch(product.category_name);
      }
    } else {
      setFormData({
        name: "",
        category_id: "",
        variant_name: "",
        variant_price: "",
        variant_cost_price: "",
        variant_sku: "",
        initial_quantity: ""
      });
      setCategorySearch("");
    }
  }, [product, open]);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('store_id', currentStoreId)
      .order('name');

    if (error) {
      toast({ title: "Error", description: "Failed to load categories", variant: "destructive" });
      return;
    }
    setCategories(data || []);
  };

  const selectedCategory = categories.find(c => c.id.toString() === formData.category_id);

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
      setFormData(prev => ({ ...prev, category_id: data.id.toString() }));
      setCategorySearch(data.name);
      setCategoryPopoverOpen(false);
      toast({ title: "Berhasil", description: `Kategori "${name}" berhasil ditambahkan` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Gagal membuat kategori", variant: "destructive" });
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleSelectCategory = (cat: Category) => {
    setFormData(prev => ({ ...prev, category_id: cat.id.toString() }));
    setCategorySearch(cat.name);
    setCategoryPopoverOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.category_id || !formData.variant_name || !formData.variant_price) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      if (product?.id) {
        const { error: productError } = await supabase
          .from('products')
          .update({ name: formData.name, category_id: parseInt(formData.category_id) })
          .eq('id', product.id);
        if (productError) throw productError;

        if (product.variant_id) {
          const { error: variantError } = await supabase
            .from('variants')
            .update({
              name: formData.variant_name,
              price: parseFloat(formData.variant_price),
              cost_price: formData.variant_cost_price ? parseFloat(formData.variant_cost_price) : null,
              sku: formData.variant_sku || null
            })
            .eq('id', product.variant_id);
          if (variantError) throw variantError;
        }

        toast({ title: "Success", description: "Product updated successfully" });
      } else {
        const { data: productData, error: productError } = await supabase
          .from('products')
          .insert({ name: formData.name, category_id: parseInt(formData.category_id), store_id: currentStoreId })
          .select()
          .single();
        if (productError) throw productError;

        const { data: variantData, error: variantError } = await supabase
          .from('variants')
          .insert({
            product_id: productData.id,
            name: formData.variant_name,
            price: parseFloat(formData.variant_price),
            cost_price: formData.variant_cost_price ? parseFloat(formData.variant_cost_price) : 0,
            sku: formData.variant_sku || null,
            store_id: currentStoreId
          })
          .select()
          .single();
        if (variantError) throw variantError;

        if (formData.initial_quantity && parseInt(formData.initial_quantity) > 0) {
          const { error: inventoryError } = await supabase
            .from('inventory')
            .insert({ variant_id: variantData.id, quantity: parseInt(formData.initial_quantity), store_id: currentStoreId });
          if (inventoryError) throw inventoryError;
        }

        toast({ title: "Success", description: "Product created successfully" });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save product", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter product name"
            />
          </div>

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
                          formData.category_id === cat.id.toString() && "bg-accent"
                        )}
                        onClick={() => handleSelectCategory(cat)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            formData.category_id === cat.id.toString() ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {cat.name}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Tidak ada kategori ditemukan
                    </div>
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

          <div>
            <Label htmlFor="variant_name">Variant Name *</Label>
            <Input
              id="variant_name"
              value={formData.variant_name}
              onChange={(e) => setFormData({ ...formData, variant_name: e.target.value })}
              placeholder="e.g. Default, Small, Large"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="variant_price">Price *</Label>
              <Input
                id="variant_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.variant_price}
                onChange={(e) => setFormData({ ...formData, variant_price: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="variant_cost_price">Cost Price</Label>
              <Input
                id="variant_cost_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.variant_cost_price}
                onChange={(e) => setFormData({ ...formData, variant_cost_price: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="variant_sku">SKU</Label>
            <Input
              id="variant_sku"
              value={formData.variant_sku}
              onChange={(e) => setFormData({ ...formData, variant_sku: e.target.value })}
              placeholder="SKU code"
            />
          </div>

          <div>
            <Label htmlFor="initial_quantity">Initial Stock Quantity</Label>
            <Input
              id="initial_quantity"
              type="number"
              min="0"
              value={formData.initial_quantity}
              onChange={(e) => setFormData({ ...formData, initial_quantity: e.target.value })}
              placeholder="Enter initial stock quantity"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-gradient-primary">
              {loading ? "Saving..." : product ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

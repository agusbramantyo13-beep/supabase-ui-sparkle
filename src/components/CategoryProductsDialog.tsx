import { useState, useEffect } from "react";
import { Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Product {
  id: number;
  name: string;
  variants: {
    id: number;
    name: string;
    price: number;
    sku: string | null;
    inventory: { quantity: number }[];
  }[];
}

interface CategoryProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: number | null;
  categoryName: string;
}

export function CategoryProductsDialog({
  open,
  onOpenChange,
  categoryId,
  categoryName,
}: CategoryProductsDialogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && categoryId) {
      fetchProducts();
    }
  }, [open, categoryId]);

  const fetchProducts = async () => {
    if (!categoryId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          variants (
            id,
            name,
            price,
            sku,
            inventory (quantity)
          )
        `)
        .eq("category_id", categoryId)
        .order("name", { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getStockBadge = (quantity: number) => {
    if (quantity === 0) {
      return <Badge variant="destructive">Habis</Badge>;
    } else if (quantity <= 10) {
      return <Badge variant="outline">{quantity}</Badge>;
    }
    return <Badge variant="secondary" className="bg-green-500/20 text-green-600">{quantity}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Produk dalam {categoryName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : products.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead>Varian</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Harga</TableHead>
                <TableHead className="text-center">Stok</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) =>
                product.variants.length > 0 ? (
                  product.variants.map((variant, idx) => (
                    <TableRow key={variant.id}>
                      {idx === 0 && (
                        <TableCell
                          rowSpan={product.variants.length}
                          className="font-medium align-top"
                        >
                          {product.name}
                        </TableCell>
                      )}
                      <TableCell>{variant.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {variant.sku || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(variant.price)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStockBadge(variant.inventory?.[0]?.quantity || 0)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell colSpan={4} className="text-muted-foreground text-center">
                      Tidak ada varian
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Belum ada produk dalam kategori ini</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

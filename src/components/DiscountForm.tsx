import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/contexts/StoreContext";
import { Switch } from "@/components/ui/switch";

const formSchema = z.object({
  name: z.string().min(1, "Nama diskon harus diisi"),
  discount_type: z.enum(["percentage", "fixed"], {
    required_error: "Tipe diskon harus dipilih",
  }),
  value: z.string().min(1, "Nilai diskon harus diisi"),
  applies_to: z.enum(["global", "product"], {
    required_error: "Penerapan diskon harus dipilih",
  }),
  target_id: z.string().optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  active: z.boolean().default(true),
});

interface Product {
  id: number;
  name: string;
}

interface DiscountFormProps {
  discount?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function DiscountForm({ discount, onSuccess, onCancel }: DiscountFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentStoreId } = useStore();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: discount?.name || "",
      discount_type: discount?.discount_type || "percentage",
      value: discount?.value?.toString() || "",
      applies_to: discount?.applies_to || "global",
      target_id: discount?.target_id || "",
      starts_at: discount?.starts_at
        ? new Date(discount.starts_at).toISOString().slice(0, 16)
        : "",
      ends_at: discount?.ends_at
        ? new Date(discount.ends_at).toISOString().slice(0, 16)
        : "",
      active: discount?.active ?? true,
    },
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq('store_id', currentStoreId)
        .order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      const discountData = {
        name: values.name,
        discount_type: values.discount_type,
        value: parseFloat(values.value),
        applies_to: values.applies_to,
        target_id: values.applies_to === "product" && values.target_id ? values.target_id : null,
        starts_at: values.starts_at ? new Date(values.starts_at).toISOString() : null,
        ends_at: values.ends_at ? new Date(values.ends_at).toISOString() : null,
        active: values.active,
        created_by: user?.id,
        store_id: currentStoreId,
      };

      if (discount) {
        const { error } = await supabase
          .from("discounts")
          .update(discountData)
          .eq("id", discount.id);

        if (error) throw error;

        toast({
          title: "Berhasil",
          description: "Diskon berhasil diperbarui",
        });
      } else {
        const { error } = await supabase.from("discounts").insert([discountData]);

        if (error) throw error;

        toast({
          title: "Berhasil",
          description: "Diskon berhasil ditambahkan",
        });
      }

      form.reset();
      onSuccess();
    } catch (error) {
      console.error("Error saving discount:", error);
      toast({
        title: "Gagal",
        description: "Gagal menyimpan diskon",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const appliesTo = form.watch("applies_to");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nama Diskon</FormLabel>
                <FormControl>
                  <Input placeholder="Misal: Diskon Akhir Tahun" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="discount_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipe Diskon</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih tipe diskon" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="percentage">Persentase (%)</SelectItem>
                    <SelectItem value="fixed">Nominal Tetap (Rp)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nilai Diskon</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={
                      form.watch("discount_type") === "percentage"
                        ? "Misal: 10 (untuk 10%)"
                        : "Misal: 50000"
                    }
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="applies_to"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Berlaku Untuk</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih penerapan" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="global">Semua Produk (Global)</SelectItem>
                    <SelectItem value="product">Produk Tertentu</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {appliesTo === "product" && (
            <FormField
              control={form.control}
              name="target_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pilih Produk</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih produk" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="starts_at"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tanggal Mulai (Opsional)</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ends_at"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tanggal Berakhir (Opsional)</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Status Aktif</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    Aktifkan atau nonaktifkan diskon ini
                  </div>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Batal
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Menyimpan..." : discount ? "Update" : "Simpan"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

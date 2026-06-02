import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useStore } from "@/contexts/StoreContext";

const formSchema = z.object({
  name: z.string().min(1, "Nama harus diisi"),
  min_purchase: z.string().min(1, "Minimal belanja harus diisi"),
  points_earned: z.string().min(1, "Poin yang didapat harus diisi"),
  applies_to: z.enum(["global", "product"]),
  target_id: z.string().optional(),
  is_multiple: z.boolean(),
  active: z.boolean(),
});

interface Product {
  id: number;
  name: string;
}

interface LoyaltyPointRule {
  id: string;
  name: string;
  min_purchase: number;
  points_earned: number;
  applies_to: string;
  target_id: string | null;
  is_multiple?: boolean;
  active: boolean;
}

interface LoyaltyPointFormProps {
  rule?: LoyaltyPointRule | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function LoyaltyPointForm({ rule, onSuccess, onCancel }: LoyaltyPointFormProps) {
  const { toast } = useToast();
  const { currentStoreId } = useStore();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: rule?.name || "",
      min_purchase: rule?.min_purchase?.toString() || "",
      points_earned: rule?.points_earned?.toString() || "",
      applies_to: (rule?.applies_to as "global" | "product") || "global",
      target_id: rule?.target_id || "",
      is_multiple: rule?.is_multiple ?? false,
      active: rule?.active ?? true,
    },
  });

  const appliesTo = form.watch("applies_to");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      let query = supabase
        .from("products")
        .select("id, name")
        .order("name");
      if (currentStoreId) query = query.eq("store_id", currentStoreId);
      const { data, error } = await query;

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      const ruleData = {
        name: values.name,
        min_purchase: parseFloat(values.min_purchase),
        points_earned: parseInt(values.points_earned),
        applies_to: values.applies_to,
        target_id: values.applies_to === "product" ? values.target_id : null,
        is_multiple: values.is_multiple,
        active: values.active,
        store_id: currentStoreId,
      };

      if (rule) {
        const { error } = await supabase
          .from("loyalty_point_rules")
          .update(ruleData)
          .eq("id", rule.id);

        if (error) throw error;

        toast({
          title: "Berhasil",
          description: "Aturan loyalty point berhasil diperbarui",
        });
      } else {
        const { error } = await supabase
          .from("loyalty_point_rules")
          .insert([ruleData]);

        if (error) throw error;

        toast({
          title: "Berhasil",
          description: "Aturan loyalty point berhasil ditambahkan",
        });
      }

      onSuccess();
    } catch (error) {
      console.error("Error saving loyalty point rule:", error);
      toast({
        title: "Gagal",
        description: "Gagal menyimpan aturan loyalty point",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Aturan</FormLabel>
              <FormControl>
                <Input placeholder="Contoh: Belanja 100rb dapat 10 poin" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="min_purchase"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Minimal Belanja (Rp)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="100000" {...field} />
              </FormControl>
              <FormDescription>
                Minimal pembelian untuk mendapatkan poin
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="points_earned"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Poin yang Didapat</FormLabel>
              <FormControl>
                <Input type="number" placeholder="10" {...field} />
              </FormControl>
              <FormDescription>
                Jumlah poin yang akan didapat member
              </FormDescription>
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
                    <SelectValue placeholder="Pilih jenis penerapan" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="global">Semua Produk</SelectItem>
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
          name="is_multiple"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Berlaku Kelipatan</FormLabel>
                <FormDescription>
                  Jika aktif, poin diberikan kelipatan dari minimal belanja (contoh: min 100rb = 10 poin, belanja 300rb = 30 poin)
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
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
                <FormDescription>
                  Aturan ini akan diterapkan saat transaksi
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Batal
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Menyimpan..." : rule ? "Perbarui" : "Simpan"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

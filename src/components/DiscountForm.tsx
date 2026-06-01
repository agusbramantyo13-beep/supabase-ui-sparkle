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
import { Checkbox } from "@/components/ui/checkbox";
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
  applies_to: z.enum(["global", "product", "category"], {
    required_error: "Penerapan diskon harus dipilih",
  }),
  target_ids: z.array(z.string()).default([]),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  active: z.boolean().default(true),
});

interface Product {
  id: number;
  name: string;
}

interface Category {
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
  const [categories, setCategories] = useState<Category[]>([]);

  const initialTargetIds: string[] = discount?.target_id
    ? String(discount.target_id).split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: discount?.name || "",
      discount_type: discount?.discount_type || "percentage",
      value: discount?.value?.toString() || "",
      applies_to: discount?.applies_to || "global",
      target_ids: initialTargetIds,
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
    fetchCategories();
  }, [currentStoreId]);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name")
      .eq("store_id", currentStoreId)
      .order("name");
    if (!error) setProducts(data || []);
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name")
      .eq("store_id", currentStoreId)
      .order("name");
    if (!error) setCategories(data || []);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      if (
        (values.applies_to === "product" || values.applies_to === "category") &&
        (!values.target_ids || values.target_ids.length === 0)
      ) {
        toast({
          title: "Gagal",
          description:
            values.applies_to === "product"
              ? "Pilih minimal satu produk"
              : "Pilih minimal satu kategori",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const discountData = {
        name: values.name,
        discount_type: values.discount_type,
        value: parseFloat(values.value),
        applies_to: values.applies_to,
        target_id:
          values.applies_to === "global" ? null : values.target_ids.join(","),
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
        toast({ title: "Berhasil", description: "Diskon berhasil diperbarui" });
      } else {
        const { error } = await supabase.from("discounts").insert([discountData]);
        if (error) throw error;
        toast({ title: "Berhasil", description: "Diskon berhasil ditambahkan" });
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
  const selectedIds = form.watch("target_ids") || [];

  const toggleId = (id: string) => {
    const current = form.getValues("target_ids") || [];
    if (current.includes(id)) {
      form.setValue(
        "target_ids",
        current.filter((x) => x !== id),
        { shouldValidate: true }
      );
    } else {
      form.setValue("target_ids", [...current, id], { shouldValidate: true });
    }
  };

  const selectAll = (ids: string[]) => {
    form.setValue("target_ids", ids, { shouldValidate: true });
  };

  const clearAll = () => {
    form.setValue("target_ids", [], { shouldValidate: true });
  };

  const targetItems =
    appliesTo === "product"
      ? products.map((p) => ({ id: p.id.toString(), name: p.name }))
      : appliesTo === "category"
      ? categories.map((c) => ({ id: c.id.toString(), name: c.name }))
      : [];

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
                <Select
                  onValueChange={(v) => {
                    field.onChange(v);
                    form.setValue("target_ids", [], { shouldValidate: true });
                  }}
                  defaultValue={field.value}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih penerapan" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="global">Semua Produk (Global)</SelectItem>
                    <SelectItem value="product">Produk Tertentu</SelectItem>
                    <SelectItem value="category">Kategori Tertentu</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

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
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 md:col-span-2">
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

        {(appliesTo === "product" || appliesTo === "category") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <FormLabel>
                Pilih {appliesTo === "product" ? "Produk" : "Kategori"} (boleh lebih dari satu)
              </FormLabel>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => selectAll(targetItems.map((i) => i.id))}
                >
                  Pilih Semua
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={clearAll}>
                  Bersihkan
                </Button>
              </div>
            </div>
            <div className="border rounded-md p-3 max-h-64 overflow-y-auto space-y-2">
              {targetItems.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Belum ada {appliesTo === "product" ? "produk" : "kategori"}.
                </p>
              )}
              {targetItems.map((item) => {
                const checked = selectedIds.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 cursor-pointer hover:bg-accent rounded px-2 py-1.5"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleId(item.id)}
                    />
                    <span className="text-sm">{item.name}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedIds.length} dipilih
            </p>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Batal
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Menyimpan..." : discount ? "Perbarui" : "Simpan"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

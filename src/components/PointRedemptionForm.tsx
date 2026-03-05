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
import { useState } from "react";
import { useStore } from "@/contexts/StoreContext";

const formSchema = z.object({
  name: z.string().min(1, "Nama harus diisi"),
  points_required: z.string().min(1, "Poin yang dibutuhkan harus diisi"),
  reward_type: z.enum(["discount_percentage", "discount_fixed"]),
  reward_value: z.string().min(1, "Nilai reward harus diisi"),
  max_discount: z.string().optional(),
  min_purchase: z.string().optional(),
  active: z.boolean(),
});

interface PointRedemptionRule {
  id: string;
  name: string;
  points_required: number;
  reward_type: string;
  reward_value: number;
  max_discount: number | null;
  min_purchase: number | null;
  active: boolean;
}

interface PointRedemptionFormProps {
  rule?: PointRedemptionRule | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PointRedemptionForm({ rule, onSuccess, onCancel }: PointRedemptionFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: rule?.name || "",
      points_required: rule?.points_required?.toString() || "",
      reward_type: (rule?.reward_type as "discount_percentage" | "discount_fixed") || "discount_percentage",
      reward_value: rule?.reward_value?.toString() || "",
      max_discount: rule?.max_discount?.toString() || "",
      min_purchase: rule?.min_purchase?.toString() || "",
      active: rule?.active ?? true,
    },
  });

  const rewardType = form.watch("reward_type");

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      const ruleData = {
        name: values.name,
        points_required: parseInt(values.points_required),
        reward_type: values.reward_type,
        reward_value: parseFloat(values.reward_value),
        max_discount: values.reward_type === "discount_percentage" && values.max_discount 
          ? parseFloat(values.max_discount) 
          : null,
        min_purchase: values.min_purchase ? parseFloat(values.min_purchase) : 0,
        active: values.active,
      };

      if (rule) {
        const { error } = await supabase
          .from("point_redemption_rules")
          .update(ruleData)
          .eq("id", rule.id);

        if (error) throw error;

        toast({
          title: "Berhasil",
          description: "Aturan redeem point berhasil diperbarui",
        });
      } else {
        const { error } = await supabase
          .from("point_redemption_rules")
          .insert([ruleData]);

        if (error) throw error;

        toast({
          title: "Berhasil",
          description: "Aturan redeem point berhasil ditambahkan",
        });
      }

      onSuccess();
    } catch (error) {
      console.error("Error saving point redemption rule:", error);
      toast({
        title: "Gagal",
        description: "Gagal menyimpan aturan redeem point",
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
                <Input placeholder="Contoh: Tukar 100 poin dapat diskon 10%" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="points_required"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Poin yang Dibutuhkan</FormLabel>
              <FormControl>
                <Input type="number" placeholder="100" {...field} />
              </FormControl>
              <FormDescription>
                Jumlah poin yang harus ditukar member
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reward_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipe Reward</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih tipe reward" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="discount_percentage">Diskon Persentase (%)</SelectItem>
                  <SelectItem value="discount_fixed">Diskon Nominal (Rp)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reward_value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Nilai Reward {rewardType === "discount_percentage" ? "(%)" : "(Rp)"}
              </FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  placeholder={rewardType === "discount_percentage" ? "10" : "50000"} 
                  {...field} 
                />
              </FormControl>
              <FormDescription>
                {rewardType === "discount_percentage" 
                  ? "Persentase diskon yang didapat member" 
                  : "Nominal diskon yang didapat member"}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {rewardType === "discount_percentage" && (
          <FormField
            control={form.control}
            name="max_discount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Maksimal Diskon (Rp) - Opsional</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="100000" {...field} />
                </FormControl>
                <FormDescription>
                  Batas maksimal diskon yang bisa didapat
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="min_purchase"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Minimal Belanja (Rp) - Opsional</FormLabel>
              <FormControl>
                <Input type="number" placeholder="50000" {...field} />
              </FormControl>
              <FormDescription>
                Minimal pembelian untuk menggunakan reward ini
              </FormDescription>
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
                <FormDescription>
                  Aturan ini dapat digunakan member untuk redeem poin
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
            {loading ? "Menyimpan..." : rule ? "Update" : "Simpan"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

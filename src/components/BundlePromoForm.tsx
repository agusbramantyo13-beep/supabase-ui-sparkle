import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/contexts/StoreContext";

interface VariantOption {
  id: number;
  name: string;
  product_name: string;
}

interface BundleItemRow {
  variant_id: string;
  quantity: string;
}

interface BundlePromoFormProps {
  bundle?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function BundlePromoForm({ bundle, onSuccess, onCancel }: BundlePromoFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentStoreId } = useStore();
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<VariantOption[]>([]);

  const [name, setName] = useState(bundle?.name || "");
  const [active, setActive] = useState<boolean>(bundle?.active ?? true);
  const [startsAt, setStartsAt] = useState(
    bundle?.starts_at ? new Date(bundle.starts_at).toISOString().slice(0, 16) : ""
  );
  const [endsAt, setEndsAt] = useState(
    bundle?.ends_at ? new Date(bundle.ends_at).toISOString().slice(0, 16) : ""
  );
  const [buyItems, setBuyItems] = useState<BundleItemRow[]>([{ variant_id: "", quantity: "1" }]);
  const [freeItems, setFreeItems] = useState<BundleItemRow[]>([{ variant_id: "", quantity: "1" }]);

  useEffect(() => {
    fetchVariants();
    if (bundle?.id) loadBundleItems(bundle.id);
  }, [currentStoreId]);

  const fetchVariants = async () => {
    const { data } = await supabase
      .from("variants")
      .select("id, name, products(name)")
      .eq("store_id", currentStoreId)
      .order("name");
    setVariants(
      (data || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        product_name: v.products?.name || "",
      }))
    );
  };

  const loadBundleItems = async (bundleId: string) => {
    const [{ data: buys }, { data: frees }] = await Promise.all([
      supabase.from("bundle_promo_buy_items").select("variant_id, quantity").eq("bundle_id", bundleId),
      supabase.from("bundle_promo_free_items").select("variant_id, quantity").eq("bundle_id", bundleId),
    ]);
    if (buys && buys.length)
      setBuyItems(buys.map((b: any) => ({ variant_id: String(b.variant_id), quantity: String(b.quantity) })));
    if (frees && frees.length)
      setFreeItems(frees.map((f: any) => ({ variant_id: String(f.variant_id), quantity: String(f.quantity) })));
  };

  const addRow = (kind: "buy" | "free") => {
    const row = { variant_id: "", quantity: "1" };
    if (kind === "buy") setBuyItems([...buyItems, row]);
    else setFreeItems([...freeItems, row]);
  };

  const removeRow = (kind: "buy" | "free", idx: number) => {
    if (kind === "buy") setBuyItems(buyItems.filter((_, i) => i !== idx));
    else setFreeItems(freeItems.filter((_, i) => i !== idx));
  };

  const updateRow = (kind: "buy" | "free", idx: number, field: "variant_id" | "quantity", value: string) => {
    const list = kind === "buy" ? [...buyItems] : [...freeItems];
    list[idx] = { ...list[idx], [field]: value };
    if (kind === "buy") setBuyItems(list);
    else setFreeItems(list);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Gagal", description: "Nama promo harus diisi", variant: "destructive" });
      return;
    }
    const cleanBuys = buyItems.filter((b) => b.variant_id && Number(b.quantity) > 0);
    const cleanFrees = freeItems.filter((f) => f.variant_id && Number(f.quantity) > 0);
    if (cleanBuys.length === 0 || cleanFrees.length === 0) {
      toast({
        title: "Gagal",
        description: "Minimal 1 item beli dan 1 item gratis",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name,
        active,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        store_id: currentStoreId,
        created_by: user?.id,
      };

      let bundleId = bundle?.id;
      if (bundle) {
        const { error } = await supabase.from("bundle_promos").update(payload).eq("id", bundle.id);
        if (error) throw error;
        // remove old rows
        await supabase.from("bundle_promo_buy_items").delete().eq("bundle_id", bundle.id);
        await supabase.from("bundle_promo_free_items").delete().eq("bundle_id", bundle.id);
      } else {
        const { data, error } = await supabase
          .from("bundle_promos")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        bundleId = data.id;
      }

      const { error: buyErr } = await supabase.from("bundle_promo_buy_items").insert(
        cleanBuys.map((b) => ({
          bundle_id: bundleId,
          variant_id: Number(b.variant_id),
          quantity: Number(b.quantity),
        }))
      );
      if (buyErr) throw buyErr;

      const { error: freeErr } = await supabase.from("bundle_promo_free_items").insert(
        cleanFrees.map((f) => ({
          bundle_id: bundleId,
          variant_id: Number(f.variant_id),
          quantity: Number(f.quantity),
        }))
      );
      if (freeErr) throw freeErr;

      toast({ title: "Berhasil", description: bundle ? "Promo diperbarui" : "Promo dibuat" });
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Gagal", description: err.message || "Gagal menyimpan promo", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const renderItemRows = (kind: "buy" | "free", rows: BundleItemRow[]) => (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <div key={idx} className="flex gap-2 items-end">
          <div className="flex-1">
            <Select
              value={row.variant_id}
              onValueChange={(v) => updateRow(kind, idx, "variant_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih produk/varian" />
              </SelectTrigger>
              <SelectContent>
                {variants.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.product_name} - {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-24">
            <Input
              type="number"
              min="1"
              value={row.quantity}
              onChange={(e) => updateRow(kind, idx, "quantity", e.target.value)}
              placeholder="Qty"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => removeRow(kind, idx)}
            disabled={rows.length === 1}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => addRow(kind)} className="gap-2">
        <Plus className="w-4 h-4" />
        Tambah Item
      </Button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nama Promo</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Misal: Beli 2 Gratis 1" />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-base">Status Aktif</Label>
            <p className="text-sm text-muted-foreground">Aktifkan promo ini</p>
          </div>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
        <div className="space-y-2">
          <Label>Tanggal Mulai (Opsional)</Label>
          <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Tanggal Berakhir (Opsional)</Label>
          <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div>
          <Label className="text-base font-semibold">Item yang Harus Dibeli</Label>
          <p className="text-sm text-muted-foreground">
            Pelanggan harus membeli semua item ini (sesuai jumlah) untuk mendapatkan promo
          </p>
        </div>
        {renderItemRows("buy", buyItems)}
      </Card>

      <Card className="p-4 space-y-3">
        <div>
          <Label className="text-base font-semibold">Item Gratis yang Didapat</Label>
          <p className="text-sm text-muted-foreground">
            Item-item ini akan otomatis ditambahkan ke keranjang dengan harga Rp 0
          </p>
        </div>
        {renderItemRows("free", freeItems)}
      </Card>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Batal
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Menyimpan..." : bundle ? "Perbarui" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}

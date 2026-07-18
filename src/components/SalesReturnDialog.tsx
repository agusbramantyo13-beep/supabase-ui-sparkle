import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2 } from "lucide-react";
import { applyInventoryChange } from "@/lib/stockHistory";

interface SalesReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string;
  saleInfo: {
    receipt_number: string | null;
    created_at: string;
    total: number;
    payment_method: string | null;
  };
  onSuccess: () => void;
}

export default function SalesReturnDialog({
  open,
  onOpenChange,
  saleId,
  saleInfo,
  onSuccess,
}: SalesReturnDialogProps) {
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleReturn = async () => {
    if (!ownerEmail || !ownerPassword) {
      toast({
        title: "Error",
        description: "Email dan password owner harus diisi",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Verify owner credentials by attempting to sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: ownerEmail,
        password: ownerPassword,
      });

      if (signInError) {
        toast({
          title: "Verifikasi Gagal",
          description: "Email atau password salah",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Check if the user is a developer or has an owner role in any store
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", signInData.user.id)
        .maybeSingle();

      let isAuthorized = profileData?.role === 'developer';
      if (!isAuthorized) {
        const { data: ownerMembership } = await supabase
          .from('store_members')
          .select('id')
          .eq('user_id', signInData.user.id)
          .eq('role', 'owner')
          .limit(1)
          .maybeSingle();
        isAuthorized = !!ownerMembership;
      }

      if (!isAuthorized) {
        toast({
          title: "Akses Ditolak",
          description: "Hanya pemilik toko yang dapat melakukan retur",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Fetch sale items to restore inventory
      const { data: saleItems, error: itemsError } = await supabase
        .from("sale_items")
        .select("variant_id, quantity")
        .eq("sale_id", saleId);

      if (itemsError) {
        toast({
          title: "Error",
          description: "Gagal memuat item penjualan",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Restore inventory for each item
      for (const item of saleItems || []) {
        if (item.variant_id) {
          const { data: inventoryData } = await supabase
            .from("inventory")
            .select("quantity")
            .eq("variant_id", item.variant_id)
            .maybeSingle();

          const currentQty = inventoryData?.quantity || 0;
          await applyInventoryChange({
            variantId: item.variant_id,
            newQuantity: currentQty + Number(item.quantity),
            type: "product_return",
            notes: `Retur penjualan #${saleId}`,
          });
        }
      }

      // Update sale status to returned
      const { error: updateError } = await supabase
        .from("sales")
        .update({
          status: "returned",
          returned_at: new Date().toISOString(),
          returned_by: signInData.user.id,
        })
        .eq("id", saleId);

      if (updateError) {
        toast({
          title: "Error",
          description: "Gagal mengupdate status penjualan",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      toast({
        title: "Berhasil",
        description: "Penjualan berhasil diretur dan stok telah dikembalikan",
      });

      setOwnerEmail("");
      setOwnerPassword("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Retur Penjualan
          </DialogTitle>
          <DialogDescription>
            Anda akan membatalkan transaksi penjualan ini. Stok yang telah terjual akan dikembalikan ke inventori.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/50 p-3 rounded-lg space-y-1 text-sm">
            <p><strong>No. Struk:</strong> {saleInfo.receipt_number || '-'}</p>
            <p><strong>Tanggal:</strong> {saleInfo.created_at}</p>
            <p><strong>Metode Pembayaran:</strong> {saleInfo.payment_method || '-'}</p>
            <p><strong>Total:</strong> Rp {saleInfo.total.toLocaleString('id-ID')}</p>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Masukkan kredensial akun <strong>owner</strong> untuk melanjutkan:
            </p>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="ownerEmailSales">Email Owner</Label>
                <Input
                  id="ownerEmailSales"
                  type="email"
                  placeholder="Masukkan email owner"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="ownerPasswordSales">Password Owner</Label>
                <Input
                  id="ownerPasswordSales"
                  type="password"
                  placeholder="Masukkan password owner"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleReturn}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memproses...
              </>
            ) : (
              "Konfirmasi Retur"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

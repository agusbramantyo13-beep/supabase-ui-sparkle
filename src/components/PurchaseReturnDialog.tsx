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

interface PurchaseReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sessionInfo: {
    supplier: string;
    purchase_date: string;
    total_cost: number;
    total_items: number;
  };
  onSuccess: () => void;
}

export default function PurchaseReturnDialog({
  open,
  onOpenChange,
  sessionId,
  sessionInfo,
  onSuccess,
}: PurchaseReturnDialogProps) {
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

      // Check if the user is an owner
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", signInData.user.id)
        .maybeSingle();

      if (profileError || !profileData || profileData.role !== "owner") {
        toast({
          title: "Akses Ditolak",
          description: "Hanya pemilik (owner) yang dapat melakukan retur",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Fetch purchase items to reverse inventory
      const { data: purchaseItems, error: itemsError } = await supabase
        .from("purchase_items")
        .select("variant_id, quantity")
        .eq("session_id", sessionId);

      if (itemsError) {
        toast({
          title: "Error",
          description: "Gagal memuat item pembelian",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Reduce inventory for each item
      for (const item of purchaseItems || []) {
        if (item.variant_id) {
          // Get current inventory
          const { data: inventoryData } = await supabase
            .from("inventory")
            .select("id, quantity")
            .eq("variant_id", item.variant_id)
            .maybeSingle();

          if (inventoryData) {
            const newQuantity = Math.max(0, inventoryData.quantity - item.quantity);
            await supabase
              .from("inventory")
              .update({ quantity: newQuantity })
              .eq("id", inventoryData.id);
          }

          // Record stock movement (out)
          await supabase.from("stock_movements").insert({
            variant_id: item.variant_id,
            quantity: item.quantity,
            movement: "out",
            created_by: signInData.user.id,
          });
        }
      }

      // Update purchase session status to returned
      const { error: updateError } = await supabase
        .from("purchase_sessions")
        .update({
          status: "returned",
          returned_at: new Date().toISOString(),
          returned_by: signInData.user.id,
        })
        .eq("id", sessionId);

      if (updateError) {
        toast({
          title: "Error",
          description: "Gagal mengupdate status pembelian",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      toast({
        title: "Berhasil",
        description: "Pembelian berhasil diretur dan stok telah dikurangi",
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
            Retur Pembelian
          </DialogTitle>
          <DialogDescription>
            Anda akan membatalkan transaksi pembelian ini. Stok yang telah ditambahkan akan dikurangi kembali.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/50 p-3 rounded-lg space-y-1 text-sm">
            <p><strong>Supplier:</strong> {sessionInfo.supplier}</p>
            <p><strong>Tanggal:</strong> {sessionInfo.purchase_date}</p>
            <p><strong>Total Item:</strong> {sessionInfo.total_items}</p>
            <p><strong>Total Modal:</strong> Rp {sessionInfo.total_cost.toLocaleString('id-ID')}</p>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Masukkan kredensial akun <strong>owner</strong> untuk melanjutkan:
            </p>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="ownerEmail">Email Owner</Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  placeholder="Masukkan email owner"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="ownerPassword">Password Owner</Label>
                <Input
                  id="ownerPassword"
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

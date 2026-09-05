import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/contexts/StoreContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Store, Plus, LogOut, Trash2, Camera, Loader2 } from "lucide-react";
import { InstallPWAButton } from "@/components/InstallPWAButton";
import { StoreLogo } from "@/components/StoreLogo";
import { uploadStoreLogo } from "@/lib/storeLogo";

export default function StoreSelection() {
  const { stores, setCurrentStore, refreshStores, loading } = useStore();
  const { user, signOut, userName } = useAuth();
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [ownerStoreIds, setOwnerStoreIds] = useState<Set<string>>(new Set());
  const [logoBusyStoreId, setLogoBusyStoreId] = useState<string | null>(null);
  const logoTargetStoreId = useRef<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          setProfileRole(data?.role || null);
        });
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      supabase
        .from('store_members')
        .select('store_id')
        .eq('user_id', user.id)
        .eq('role', 'owner')
        .then(({ data }) => {
          setOwnerStoreIds(new Set((data || []).map((r: any) => r.store_id)));
        });
    }
  }, [user]);

  const canCreateStore = profileRole === 'developer';
  const isDeveloper = profileRole === 'developer';

  const canEditLogo = (storeId: string) => isDeveloper || ownerStoreIds.has(storeId);

  const handlePickLogo = (storeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    logoTargetStoreId.current = storeId;
    logoInputRef.current?.click();
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const storeId = logoTargetStoreId.current;
    if (!file || !storeId) return;
    setLogoBusyStoreId(storeId);
    try {
      const path = await uploadStoreLogo(storeId, file);
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('stores')
        .update({ logo_path: path, logo_updated_at: now })
        .eq('id', storeId);
      if (error) throw error;
      await refreshStores();
      toast({ title: "Berhasil", description: "Logo toko diperbarui" });
    } catch (err: any) {
      toast({ title: "Gagal upload logo", description: err.message, variant: "destructive" });
    } finally {
      setLogoBusyStoreId(null);
    }
  };
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreAddress, setNewStoreAddress] = useState("");
  const [newStorePhone, setNewStorePhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleSelectStore = (store: any) => {
    setCurrentStore(store);
    navigate("/");
  };

  const handleCreateStore = async () => {
    if (!newStoreName.trim() || !user) return;
    setCreating(true);

    try {
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .insert({
          name: newStoreName.trim(),
          address: newStoreAddress.trim() || null,
          phone: newStorePhone.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (storeError) throw storeError;

      const { error: memberError } = await supabase
        .from('store_members')
        .insert({
          store_id: store.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) throw memberError;

      toast({ title: "Berhasil", description: `Toko "${store.name}" berhasil dibuat` });
      await refreshStores();
      setCurrentStore(store);
      navigate("/");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteStore = async () => {
    if (!storeToDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('stores').delete().eq('id', storeToDelete.id);
      if (error) throw error;
      toast({ title: "Berhasil", description: `Toko "${storeToDelete.name}" berhasil dihapus` });
      setStoreToDelete(null);
      await refreshStores();
    } catch (error: any) {
      const isFk = error?.code === '23503' || /foreign key|violates/i.test(error?.message || '');
      toast({
        title: "Gagal menghapus toko",
        description: isFk
          ? "Toko ini masih punya data terkait (mis. mutasi stok antar toko). Hapus/pindahkan data tersebut terlebih dahulu."
          : error?.message || 'Terjadi kesalahan',
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">KENZHO Apps</h1>
          <p className="text-muted-foreground">
            Selamat datang, {userName || user?.email}! Pilih toko untuk melanjutkan.
          </p>
        </div>

        <div className="flex justify-center">
          <InstallPWAButton />
        </div>

        {stores.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {stores.map((store) => (
              <Card
                key={store.id}
                className="cursor-pointer hover:border-primary transition-colors relative"
                onClick={() => handleSelectStore(store)}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="relative shrink-0">
                    <StoreLogo
                      logoPath={store.logo_path}
                      updatedAt={store.logo_updated_at}
                      alt={store.name}
                      className="w-12 h-12 rounded-lg"
                      iconClassName="w-6 h-6"
                    />
                    {canEditLogo(store.id) && (
                      <button
                        type="button"
                        onClick={(e) => handlePickLogo(store.id, e)}
                        disabled={logoBusyStoreId === store.id}
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow"
                        aria-label={`Ganti logo ${store.name}`}
                      >
                        {logoBusyStoreId === store.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Camera className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{store.name}</p>
                    {store.address && (
                      <p className="text-sm text-muted-foreground truncate">{store.address}</p>
                    )}
                  </div>
                  {isDeveloper && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStoreToDelete(store);
                      }}
                      aria-label={`Hapus toko ${store.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {stores.length === 0 && !canCreateStore && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Anda belum terdaftar di toko manapun. Hubungi pemilik toko untuk menambahkan Anda.
            </CardContent>
          </Card>
        )}

        {canCreateStore && !showCreateForm ? (
          <div className="flex gap-3 justify-center">
            <Button onClick={() => setShowCreateForm(true)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Buat Toko Baru
            </Button>
            <Button onClick={signOut} variant="ghost">
              <LogOut className="w-4 h-4 mr-2" />
              Keluar
            </Button>
          </div>
        ) : canCreateStore && showCreateForm ? (
          <Card>
            <CardHeader>
              <CardTitle>Buat Toko Baru</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nama Toko *</Label>
                <Input
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="Masukkan nama toko"
                />
              </div>
              <div className="space-y-2">
                <Label>Alamat</Label>
                <Input
                  value={newStoreAddress}
                  onChange={(e) => setNewStoreAddress(e.target.value)}
                  placeholder="Masukkan alamat toko"
                />
              </div>
              <div className="space-y-2">
                <Label>Telepon</Label>
                <Input
                  value={newStorePhone}
                  onChange={(e) => setNewStorePhone(e.target.value)}
                  placeholder="Masukkan nomor telepon"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateStore} disabled={creating || !newStoreName.trim()}>
                  {creating ? "Membuat..." : "Buat Toko"}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex justify-center">
            <Button onClick={signOut} variant="ghost">
              <LogOut className="w-4 h-4 mr-2" />
              Keluar
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={!!storeToDelete} onOpenChange={(open) => !open && setStoreToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus toko "{storeToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak bisa dibatalkan. Semua data terkait toko ini (produk, penjualan, member, inventaris, dst.) akan ikut terhapus secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteStore();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

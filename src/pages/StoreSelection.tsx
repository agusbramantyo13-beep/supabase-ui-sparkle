import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/contexts/StoreContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Store, Plus, LogOut } from "lucide-react";

export default function StoreSelection() {
  const { stores, setCurrentStore, refreshStores, loading } = useStore();
  const { user, signOut, userName } = useAuth();
  const [profileRole, setProfileRole] = useState<string | null>(null);

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

  const isOwner = profileRole === 'owner';
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreAddress, setNewStoreAddress] = useState("");
  const [newStorePhone, setNewStorePhone] = useState("");
  const [creating, setCreating] = useState(false);

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

      // Add creator as owner of the store
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">KENZHO Apps</h1>
          <p className="text-muted-foreground">
            Selamat datang, {userName || user?.email}! Pilih toko untuk melanjutkan.
          </p>
        </div>

        {stores.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {stores.map((store) => (
              <Card
                key={store.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleSelectStore(store)}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Store className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{store.name}</p>
                    {store.address && (
                      <p className="text-sm text-muted-foreground truncate">{store.address}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {stores.length === 0 && !isOwner && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Anda belum terdaftar di toko manapun. Hubungi pemilik toko untuk menambahkan Anda.
            </CardContent>
          </Card>
        )}

        {isOwner && !showCreateForm ? (
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
        ) : isOwner && showCreateForm ? (
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
    </div>
  );
}

import { useState, useEffect } from "react";
import { User, UserPlus, Edit, Trash2, Shield, ShoppingCart, Store, Eye, EyeOff, KeyRound, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/contexts/StoreContext";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: 'developer' | 'staff';
  created_at: string;
}

interface StoreInfo {
  id: string;
  name: string;
}

interface StoreMembership {
  id: string;
  store_id: string;
  role: string;
  store_name: string;
}

export default function Users() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedRole, setEditedRole] = useState<'developer' | 'staff'>('staff');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<'developer' | 'staff'>('staff');
  const [isCreating, setIsCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  // Store assignment states
  const [allStores, setAllStores] = useState<StoreInfo[]>([]);
  const [userMemberships, setUserMemberships] = useState<StoreMembership[]>([]);
  const [newUserStoreId, setNewUserStoreId] = useState("");
  const [newUserStoreRole, setNewUserStoreRole] = useState("cashier");
  const [editStoreId, setEditStoreId] = useState("");
  const [editStoreRole, setEditStoreRole] = useState("cashier");
  const [userStoreMap, setUserStoreMap] = useState<Record<string, StoreMembership[]>>({});

  useEffect(() => {
    fetchUsers();
    fetchAllStores();
  }, []);

  useEffect(() => {
    if (addDialogOpen) {
      fetchAllStores();
    }
  }, [addDialogOpen]);

  const fetchAllStores = async () => {
    const { data } = await supabase.from('stores').select('id, name').order('name');
    // Deduplicate stores (multiple RLS policies may return duplicates)
    const unique = (data || []).filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);
    setAllStores(unique);
  };

  const fetchUserMemberships = async (userId: string) => {
    const { data } = await supabase
      .from('store_members')
      .select('id, store_id, role, stores(name)')
      .eq('user_id', userId);

    if (data) {
      const memberships: StoreMembership[] = data.map((m: any) => ({
        id: m.id,
        store_id: m.store_id,
        role: m.role,
        store_name: m.stores?.name || 'Unknown'
      }));
      setUserMemberships(memberships);
    } else {
      setUserMemberships([]);
    }
  };

  const fetchAllUserMemberships = async () => {
    const { data } = await supabase
      .from('store_members')
      .select('id, store_id, role, user_id, stores(name)');

    if (data) {
      const map: Record<string, StoreMembership[]> = {};
      (data as any[]).forEach(m => {
        if (!map[m.user_id]) map[m.user_id] = [];
        map[m.user_id].push({
          id: m.id,
          store_id: m.store_id,
          role: m.role,
          store_name: m.stores?.name || 'Unknown'
        });
      });
      setUserStoreMap(map);
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: "Gagal", description: "Gagal memuat pengguna", variant: "destructive" });
      return;
    }

    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (users.length > 0) {
      fetchAllUserMemberships();
    }
  }, [users]);

  const openEditDialog = async (user: UserProfile) => {
    setSelectedUser(user);
    setEditedName(user.name || "");
    setEditedRole(user.role);
    setNewPassword("");
    setShowNewPassword(false);
    setEditStoreId("");
    setEditStoreRole("cashier");
    setEditDialogOpen(true);
    await fetchAllStores();
    await fetchUserMemberships(user.id);
  };

  const addStoreMembership = async (userId: string, storeId: string, role: string) => {
    if (!storeId) return;
    
    const { error } = await supabase.from('store_members').insert({
      user_id: userId,
      store_id: storeId,
      role: role,
    });

    if (error) {
      if (error.code === '23505') {
        toast({ title: "Gagal", description: "Pengguna sudah terdaftar di toko ini", variant: "destructive" });
      } else {
        toast({ title: "Gagal", description: error.message, variant: "destructive" });
      }
      return false;
    }

    toast({ title: "Berhasil", description: "Pengguna ditambahkan ke toko" });
    return true;
  };

  const removeStoreMembership = async (membershipId: string) => {
    const { error } = await supabase.from('store_members').delete().eq('id', membershipId);
    if (error) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Berhasil", description: "Pengguna dihapus dari toko" });
    if (selectedUser) await fetchUserMemberships(selectedUser.id);
    await fetchAllUserMemberships();
  };

  const updateStoreMembershipRole = async (membershipId: string, newRole: string) => {
    const { error } = await supabase.from('store_members').update({ role: newRole }).eq('id', membershipId);
    if (error) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Berhasil", description: "Peran di toko diperbarui" });
    if (selectedUser) await fetchUserMemberships(selectedUser.id);
    await fetchAllUserMemberships();
  };

  const handleAddStoreInEdit = async () => {
    if (!selectedUser || !editStoreId) return;
    const success = await addStoreMembership(selectedUser.id, editStoreId, editStoreRole);
    if (success) {
      setEditStoreId("");
      setEditStoreRole("cashier");
      await fetchUserMemberships(selectedUser.id);
      await fetchAllUserMemberships();
    }
  };

  const saveUserEdit = async () => {
    if (!selectedUser) return;
    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: editedName, role: editedRole })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast({ title: "Berhasil", description: "Data pengguna berhasil diperbarui" });
      await fetchUsers();
      await fetchAllUserMemberships();
      setEditDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message || "Gagal memperbarui data pengguna", variant: "destructive" });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const resetUserPassword = async () => {
    if (!selectedUser || !newPassword) return;
    if (newPassword.length < 6) {
      toast({ title: "Gagal", description: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }
    setIsResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { user_id: selectedUser.id, new_password: newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Berhasil", description: "Password berhasil diubah" });
      setNewPassword("");
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message || "Gagal mengubah password", variant: "destructive" });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const createUser = async () => {
    if (!newUserEmail || !newUserName || !newUserPassword || !newUserRole) {
      toast({ title: "Error", description: "Mohon isi semua field", variant: "destructive" });
      return;
    }

    setIsCreating(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: newUserEmail,
          password: newUserPassword,
          name: newUserName,
          role: newUserRole,
          store_id: newUserStoreId || undefined,
          store_role: newUserStoreId ? newUserStoreRole : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.warning) {
        toast({ title: "Berhasil dengan peringatan", description: data.warning });
      } else {
        toast({ title: "Berhasil", description: "Pengguna berhasil dibuat" });
      }

      setNewUserEmail("");
      setNewUserName("");
      setNewUserPassword("");
      setNewUserRole('staff');
      setNewUserStoreId("");
      setNewUserStoreRole("cashier");
      setAddDialogOpen(false);
      await fetchUsers();
      await fetchAllUserMemberships();
    } catch (error: any) {
      console.error("Create user error:", error);
      toast({ title: "Error", description: error?.message || "Gagal membuat pengguna", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };


  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { user_id: userToDelete.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Berhasil", description: "Pengguna dan akun login berhasil dihapus" });
      await fetchUsers();
      await fetchAllUserMemberships();
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Gagal menghapus pengguna", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteDialog = (user: UserProfile) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'developer': return 'bg-gradient-primary text-primary-foreground';
      case 'staff': return 'bg-secondary text-secondary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'developer': return <Shield className="w-4 h-4" />;
      case 'staff': return <User className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'developer': return 'Developer';
      case 'staff': return 'Staff';
      default: return role;
    }
  };

  const getStoreNames = (userId: string) => {
    const memberships = userStoreMap[userId] || [];
    return memberships.map(m => m.store_name).filter(Boolean);
  };

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Pengguna</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-card animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const StoreAssignmentSection = ({ isNew }: { isNew: boolean }) => {
    const storeId = isNew ? newUserStoreId : editStoreId;
    const storeRole = isNew ? newUserStoreRole : editStoreRole;
    const setStoreId = isNew ? setNewUserStoreId : setEditStoreId;
    const setStoreRole = isNew ? setNewUserStoreRole : setEditStoreRole;

    const availableStores = isNew
      ? allStores
      : allStores.filter(s => !userMemberships.find(m => m.store_id === s.id));

    return (
      <div className="border-t border-border pt-4 space-y-3">
        <Label className="font-medium">Penugasan Toko</Label>

        {!isNew && userMemberships.length > 0 && (
          <div className="space-y-2">
            {userMemberships.map(m => (
              <div key={m.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{m.store_name}</span>
                  <Select value={m.role} onValueChange={(value) => updateStoreMembershipRole(m.id, value)}>
                    <SelectTrigger className="h-7 w-28 text-xs border-border bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cashier">Karyawan</SelectItem>
                      <SelectItem value="owner">Pemilik</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeStoreMembership(m.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {availableStores.length > 0 && (
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Toko</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih toko" />
                </SelectTrigger>
                <SelectContent>
                  {availableStores.map(store => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36 space-y-1">
              <Label className="text-xs text-muted-foreground">Peran di Toko</Label>
              <Select value={storeRole} onValueChange={setStoreRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashier">Karyawan</SelectItem>
                  <SelectItem value="owner">Pemilik</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!isNew && (
              <Button size="sm" onClick={handleAddStoreInEdit} disabled={!storeId} className="bg-gradient-primary">
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        {!isNew && availableStores.length === 0 && userMemberships.length > 0 && (
          <p className="text-xs text-muted-foreground">Pengguna sudah terdaftar di semua toko.</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Pengguna</h1>
          <p className="text-muted-foreground">Kelola akun pengguna, peran, dan penugasan toko</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:bg-primary/90">
              <UserPlus className="w-4 h-4 mr-2" />
              Tambah Pengguna
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tambah Pengguna Baru</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nama</Label>
                <Input id="name" type="text" placeholder="Masukkan nama lengkap" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="user@example.com" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="Masukkan password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} className="pr-10" />
                  <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label>Peran</Label>
                <Select value={newUserRole} onValueChange={(value: 'developer' | 'staff') => setNewUserRole(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">
                      <div className="flex items-center gap-2"><User className="w-4 h-4" />Staff</div>
                    </SelectItem>
                    <SelectItem value="developer">
                      <div className="flex items-center gap-2"><Shield className="w-4 h-4" />Developer</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <StoreAssignmentSection isNew={true} />

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Batal</Button>
                <Button onClick={createUser} disabled={isCreating} className="bg-gradient-primary hover:bg-primary/90">
                  {isCreating ? "Membuat..." : "Buat Pengguna"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <Input placeholder="Cari pengguna berdasarkan nama atau email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />
      </div>

      {filteredUsers.length === 0 ? (
        <Card className="bg-card">
          <CardContent className="p-12 text-center">
            <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Tidak ada pengguna</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? "Tidak ada pengguna yang cocok" : "Belum ada pengguna yang ditambahkan"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((user) => {
            const storeNames = getStoreNames(user.id);
            return (
              <Card key={user.id} className="bg-card hover:shadow-card transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-foreground">{user.name || user.email}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {user.name ? user.email : `Bergabung ${new Date(user.created_at).toLocaleDateString('id-ID')}`}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Nama</span>
                      <span className="text-sm font-medium text-foreground">{user.name || '-'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Email</span>
                      <span className="text-sm font-medium text-foreground truncate ml-2">{user.email}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Peran</span>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        <div className="flex items-center gap-1">
                          {getRoleIcon(user.role)}
                          <span>{getRoleDisplayName(user.role)}</span>
                        </div>
                      </Badge>
                    </div>

                    <div className="flex items-start justify-between">
                      <span className="text-sm text-muted-foreground">Toko</span>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {storeNames.length > 0 ? storeNames.map((name, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            <Store className="w-3 h-3 mr-1" />
                            {name}
                          </Badge>
                        )) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog(user)}>
                        <Edit className="w-4 h-4 mr-2" />Edit
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={() => openDeleteDialog(user)}>
                        <Trash2 className="w-4 h-4 mr-2" />Hapus
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Pengguna</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input value={selectedUser.email} disabled />
              </div>
              <div>
                <Label htmlFor="edit-name">Nama</Label>
                <Input id="edit-name" type="text" placeholder="Masukkan nama lengkap" value={editedName} onChange={(e) => setEditedName(e.target.value)} />
              </div>
              <div>
                <Label>Peran</Label>
                <Select value={editedRole} onValueChange={(value: 'developer' | 'staff') => setEditedRole(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">
                      <div className="flex items-center gap-2"><User className="w-4 h-4" />Staff</div>
                    </SelectItem>
                    <SelectItem value="developer">
                      <div className="flex items-center gap-2"><Shield className="w-4 h-4" />Developer</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <StoreAssignmentSection isNew={false} />

              <div className="border-t border-border pt-4">
                <Label className="text-muted-foreground text-sm">Ganti Password</Label>
                <p className="text-xs text-muted-foreground mb-2">Masukkan password baru untuk pengguna ini (minimal 6 karakter).</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input type={showNewPassword ? "text" : "password"} placeholder="Password baru" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pr-10" minLength={6} />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <Button type="button" variant="outline" onClick={resetUserPassword} disabled={isResettingPassword || !newPassword}>
                    <KeyRound className="w-4 h-4 mr-2" />{isResettingPassword ? "Mengubah..." : "Ubah"}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Batal</Button>
                <Button onClick={saveUserEdit} disabled={isSavingEdit} className="bg-gradient-primary hover:bg-primary/90">
                  {isSavingEdit ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pengguna</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus pengguna "{userToDelete?.email}"? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

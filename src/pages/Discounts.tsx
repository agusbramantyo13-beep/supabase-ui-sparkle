import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Calendar, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DiscountForm } from "@/components/DiscountForm";
import { LoyaltyPointForm } from "@/components/LoyaltyPointForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface Discount {
  id: string;
  name: string;
  discount_type: string;
  value: number;
  applies_to: string;
  target_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  created_at: string;
}

interface LoyaltyPointRule {
  id: string;
  name: string;
  min_purchase: number;
  points_earned: number;
  applies_to: string;
  target_id: string | null;
  active: boolean;
  created_at: string;
}

export default function Discounts() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loyaltyRules, setLoyaltyRules] = useState<LoyaltyPointRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showLoyaltyForm, setShowLoyaltyForm] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [editingLoyaltyRule, setEditingLoyaltyRule] = useState<LoyaltyPointRule | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoyaltyId, setDeleteLoyaltyId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchDiscounts();
    fetchLoyaltyRules();
  }, []);

  const fetchDiscounts = async () => {
    try {
      const { data, error } = await supabase
        .from("discounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDiscounts(data || []);
    } catch (error) {
      console.error("Error fetching discounts:", error);
      toast({
        title: "Gagal",
        description: "Gagal memuat data diskon",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLoyaltyRules = async () => {
    try {
      const { data, error } = await supabase
        .from("loyalty_point_rules")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLoyaltyRules(data || []);
    } catch (error) {
      console.error("Error fetching loyalty rules:", error);
      toast({
        title: "Gagal",
        description: "Gagal memuat data loyalty point",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("discounts")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Diskon berhasil dihapus",
      });
      fetchDiscounts();
    } catch (error) {
      console.error("Error deleting discount:", error);
      toast({
        title: "Gagal",
        description: "Gagal menghapus diskon",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const handleDeleteLoyalty = async () => {
    if (!deleteLoyaltyId) return;

    try {
      const { error } = await supabase
        .from("loyalty_point_rules")
        .delete()
        .eq("id", deleteLoyaltyId);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Aturan loyalty point berhasil dihapus",
      });
      fetchLoyaltyRules();
    } catch (error) {
      console.error("Error deleting loyalty rule:", error);
      toast({
        title: "Gagal",
        description: "Gagal menghapus aturan loyalty point",
        variant: "destructive",
      });
    } finally {
      setDeleteLoyaltyId(null);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingDiscount(null);
    fetchDiscounts();
  };

  const handleLoyaltyFormSuccess = () => {
    setShowLoyaltyForm(false);
    setEditingLoyaltyRule(null);
    fetchLoyaltyRules();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatValue = (discount: Discount) => {
    if (discount.discount_type === "percentage") {
      return `${discount.value}%`;
    }
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
    }).format(discount.value);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Diskon & Loyalty</h1>
          <p className="text-muted-foreground">
            Kelola diskon produk, promosi, dan program loyalty point untuk member
          </p>
        </div>
      </div>

      <Tabs defaultValue="discounts" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="discounts">Diskon Produk</TabsTrigger>
          <TabsTrigger value="loyalty">
            <Gift className="w-4 h-4 mr-2" />
            Loyalty Point
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discounts" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditingDiscount(null);
                setShowForm(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Tambah Diskon
            </Button>
          </div>

          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingDiscount ? "Edit Diskon" : "Tambah Diskon Baru"}
                </CardTitle>
                <CardDescription>
                  Isi form di bawah untuk {editingDiscount ? "mengubah" : "menambahkan"} diskon
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DiscountForm
                  discount={editingDiscount}
                  onSuccess={handleFormSuccess}
                  onCancel={() => {
                    setShowForm(false);
                    setEditingDiscount(null);
                  }}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Daftar Diskon</CardTitle>
              <CardDescription>
                Total {discounts.length} diskon terdaftar
              </CardDescription>
            </CardHeader>
            <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Memuat data...
            </div>
          ) : discounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Belum ada diskon. Klik tombol "Tambah Diskon" untuk membuat diskon baru.
            </div>
          ) : (
            <div className="space-y-4">
              {discounts.map((discount) => (
                <div
                  key={discount.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{discount.name}</h3>
                      <Badge variant={discount.active ? "default" : "secondary"}>
                        {discount.active ? "Aktif" : "Nonaktif"}
                      </Badge>
                      <Badge variant="outline">
                        {discount.applies_to === "global" ? "Global" : "Produk"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Nilai: {formatValue(discount)}
                      </span>
                      {discount.starts_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(discount.starts_at)} - {formatDate(discount.ends_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingDiscount(discount);
                        setShowForm(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteId(discount.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="loyalty" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditingLoyaltyRule(null);
                setShowLoyaltyForm(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Tambah Aturan Loyalty
            </Button>
          </div>

          {showLoyaltyForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingLoyaltyRule ? "Edit Aturan Loyalty" : "Tambah Aturan Loyalty Baru"}
                </CardTitle>
                <CardDescription>
                  Atur minimal belanja dan poin yang didapat untuk member
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LoyaltyPointForm
                  rule={editingLoyaltyRule}
                  onSuccess={handleLoyaltyFormSuccess}
                  onCancel={() => {
                    setShowLoyaltyForm(false);
                    setEditingLoyaltyRule(null);
                  }}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Aturan Loyalty Point</CardTitle>
              <CardDescription>
                Total {loyaltyRules.length} aturan loyalty terdaftar (Khusus Member)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Memuat data...
                </div>
              ) : loyaltyRules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Belum ada aturan loyalty. Klik tombol "Tambah Aturan Loyalty" untuk membuat aturan baru.
                </div>
              ) : (
                <div className="space-y-4">
                  {loyaltyRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{rule.name}</h3>
                          <Badge variant={rule.active ? "default" : "secondary"}>
                            {rule.active ? "Aktif" : "Nonaktif"}
                          </Badge>
                          <Badge variant="outline">
                            {rule.applies_to === "global" ? "Semua Produk" : "Produk Tertentu"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">
                            Min. Belanja: {new Intl.NumberFormat("id-ID", {
                              style: "currency",
                              currency: "IDR",
                            }).format(rule.min_purchase)}
                          </span>
                          <span className="font-medium text-foreground">
                            Poin: {rule.points_earned}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingLoyaltyRule(rule);
                            setShowLoyaltyForm(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteLoyaltyId(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Diskon</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus diskon ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteLoyaltyId} onOpenChange={() => setDeleteLoyaltyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Aturan Loyalty</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus aturan loyalty ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLoyalty}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Store, Users, CreditCard, Bell, Shield, Database, User as UserIcon, Printer, Upload, Bluetooth } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme, THEMES } from "@/contexts/ThemeContext";
import { Check } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useBluetoothPrinter } from "@/contexts/BluetoothPrinterContext";

const RECEIPT_SETTINGS_KEY = "receipt_design_settings";

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const { theme, setTheme } = useTheme();
  const [themeSaving, setThemeSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      
      setLoadingProfile(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setUserProfile(data);
      }
      setLoadingProfile(false);
    };
    
    fetchUserProfile();
  }, [user]);

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'developer':
        return 'default';
      case 'staff':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'developer':
        return 'Developer';
      case 'staff':
        return 'Staff';
      default:
        return role;
    }
  };

  const [settings, setSettings] = useState({
    storeName: "KENZHO Apps Store",
    storeAddress: "123 Main Street, City, State 12345",
    storePhone: "+1 (555) 123-4567",
    storeEmail: "store@kenzho.com",
    taxRate: "8.25",
    currency: "IDR",
    receiptFooter: "Terima kasih atas kunjungan Anda!",
    
    // Notifications
    lowStockAlerts: true,
    salesNotifications: true,
    emailReports: false,
    
    // Security
    requireLoginForSales: true,
    sessionTimeout: "60",
    enableAuditLog: true,

    // Printer & Receipt
    printerConnected: false,
    receiptLogo: "",
    receiptPhone: "",
    receiptInstagram: "",
    receiptWhatsapp: "",
    receiptCustomText: "",
  });

  const btPrinter = useBluetoothPrinter();

  // Load saved receipt design settings from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECEIPT_SETTINGS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setSettings(prev => ({ ...prev, ...saved }));
      }
    } catch (e) {
      console.error("Failed to load receipt settings", e);
    }
  }, []);

  const handleSaveReceiptDesign = () => {
    try {
      const payload = {
        receiptLogo: settings.receiptLogo,
        receiptPhone: settings.receiptPhone,
        receiptWhatsapp: settings.receiptWhatsapp,
        receiptInstagram: settings.receiptInstagram,
        receiptCustomText: settings.receiptCustomText,
        receiptFooter: settings.receiptFooter,
      };
      localStorage.setItem(RECEIPT_SETTINGS_KEY, JSON.stringify(payload));
      toast({
        title: "Berhasil",
        description: "Desain struk nota tersimpan",
      });
    } catch (e: any) {
      toast({
        title: "Gagal",
        description: e?.message || "Tidak bisa menyimpan desain struk",
        variant: "destructive",
      });
    }
  };

  const handleTestPrintReceipt = async () => {
    try {
      if (!btPrinter.connected) {
        toast({
          title: "Printer Belum Terhubung",
          description: "Hubungkan printer Bluetooth terlebih dahulu di tab Printer.",
          variant: "destructive",
        });
        return;
      }
      const footerParts: string[] = [];
      if (settings.receiptWhatsapp) footerParts.push(`WA: ${settings.receiptWhatsapp}`);
      if (settings.receiptInstagram) footerParts.push(`IG: ${settings.receiptInstagram}`);
      const combinedFooter = [
        settings.receiptFooter,
        settings.receiptCustomText,
        footerParts.join(" | "),
      ].filter(Boolean).join("\n");

      await btPrinter.printReceipt({
        storeName: settings.storeName,
        logo: settings.receiptLogo || undefined,

        storeAddress: settings.storeAddress,
        storePhone: settings.receiptPhone || settings.storePhone,
        storeFooter: combinedFooter || "Terima kasih!",
        receiptNumber: "TEST-0001",
        dateTime: new Date().toLocaleString("id-ID"),
        cashier: "Tes",
        paymentMethod: "Tunai",
        items: [
          { name: "Produk Contoh A", qty: 1, price: 10000, total: 10000 },
          { name: "Produk Contoh B", qty: 2, price: 15000, total: 30000 },
        ],
        subtotal: 40000,
        total: 40000,
        cash: 50000,
        change: 10000,
      });
      toast({ title: "Berhasil", description: "Tes cetak struk terkirim" });
    } catch (e: any) {
      toast({
        title: "Gagal Cetak",
        description: e?.message || "Tidak bisa mengirim ke printer",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    
    // Simulate save operation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Berhasil",
      description: "Pengaturan berhasil disimpan",
    });
    
    setLoading(false);
  };

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleConnectPrinter = async () => {
    try {
      if (!btPrinter.supported) {
        toast({
          title: "Tidak Didukung",
          description:
            "Web Bluetooth tidak tersedia. Buka aplikasi ini di Chrome (Android/Desktop) lewat HTTPS. Pada WebView/wrapper, pastikan wrapper mendukung Web Bluetooth (mis. Bubblewrap/TWA Chrome).",
          variant: "destructive",
        });
        return;
      }
      await btPrinter.connect();
      toast({
        title: "Berhasil",
        description: `Printer ${btPrinter.deviceName || ""} terhubung`,
      });
    } catch (error: any) {
      console.error("Bluetooth error:", error);
      toast({
        title: "Gagal",
        description: error?.message || "Gagal menghubungkan printer",
        variant: "destructive",
      });
    }
  };

  const handleDisconnectPrinter = () => {
    btPrinter.disconnect();
    toast({
      title: "Terputus",
      description: "Printer telah diputus",
    });
  };

  const handleTestPrint = async () => {
    try {
      await btPrinter.printTest(settings.storeName);
      toast({ title: "Berhasil", description: "Tes cetak terkirim" });
    } catch (e: any) {
      toast({
        title: "Gagal Cetak",
        description: e?.message || "Tidak bisa mengirim ke printer",
        variant: "destructive",
      });
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleSettingChange('receiptLogo', reader.result as string);
        toast({
          title: "Berhasil",
          description: "Logo berhasil diunggah",
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Pengaturan</h1>
          <p className="text-muted-foreground">Konfigurasi toko dan preferensi aplikasi Anda</p>
        </div>
        <Button 
          className="bg-gradient-primary hover:bg-primary/90"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </div>

      {/* User Info Card */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-primary" />
            <CardTitle>Informasi Pengguna Login</CardTitle>
          </div>
          <CardDescription>Detail akun dan hak akses yang sedang aktif</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingProfile ? (
            <p className="text-muted-foreground">Memuat data pengguna...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Email</h4>
                  <p className="text-base text-foreground">{user?.email || '-'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">User ID</h4>
                  <p className="text-xs text-muted-foreground font-mono">{user?.id || '-'}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Role / Hak Akses</h4>
                  <Badge variant={getRoleBadgeVariant(userProfile?.role || 'staff')} className="text-sm">
                    {getRoleLabel(userProfile?.role || 'staff')}
                  </Badge>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Tanggal Dibuat</h4>
                  <p className="text-base text-foreground">
                    {userProfile?.created_at 
                      ? new Date(userProfile.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : '-'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="store" className="space-y-6">
        <TabsList className="grid grid-cols-6 w-full max-w-3xl">
          <TabsTrigger value="store">Toko</TabsTrigger>
          <TabsTrigger value="printer">Printer</TabsTrigger>
          <TabsTrigger value="notifications">Notifikasi</TabsTrigger>
          <TabsTrigger value="security">Keamanan</TabsTrigger>
          <TabsTrigger value="system">Sistem</TabsTrigger>
          <TabsTrigger value="appearance">Tampilan</TabsTrigger>
        </TabsList>

        <TabsContent value="store" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" />
                <CardTitle>Informasi Toko</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="storeName">Nama Toko</Label>
                  <Input
                    id="storeName"
                    value={settings.storeName}
                    onChange={(e) => handleSettingChange('storeName', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="storeEmail">Alamat Email</Label>
                  <Input
                    id="storeEmail"
                    type="email"
                    value={settings.storeEmail}
                    onChange={(e) => handleSettingChange('storeEmail', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="storeAddress">Alamat</Label>
                <Input
                  id="storeAddress"
                  value={settings.storeAddress}
                  onChange={(e) => handleSettingChange('storeAddress', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="storePhone">Nomor Telepon</Label>
                  <Input
                    id="storePhone"
                    value={settings.storePhone}
                    onChange={(e) => handleSettingChange('storePhone', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Mata Uang</Label>
                  <Input
                    id="currency"
                    value={settings.currency}
                    onChange={(e) => handleSettingChange('currency', e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Pengaturan Pajak & Struk</h3>
                
                <div>
                  <Label htmlFor="taxRate">Tarif Pajak (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    step="0.01"
                    value={settings.taxRate}
                    onChange={(e) => handleSettingChange('taxRate', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="receiptFooter">Pesan Footer Struk</Label>
                  <Input
                    id="receiptFooter"
                    value={settings.receiptFooter}
                    onChange={(e) => handleSettingChange('receiptFooter', e.target.value)}
                    placeholder="Pesan yang ditampilkan di footer struk"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="printer" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-primary" />
                <CardTitle>Koneksi Printer Bluetooth</CardTitle>
              </div>
              <CardDescription>Hubungkan printer thermal untuk mencetak struk</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Bluetooth className="w-8 h-8 text-primary" />
                  <div>
                    <h4 className="font-medium">
                      {btPrinter.connected
                        ? (btPrinter.deviceName || "Printer Terhubung")
                        : (btPrinter.deviceName ? `${btPrinter.deviceName} (belum terhubung)` : "Tidak Ada Printer")}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {btPrinter.connected ? "Status: Terhubung" : "Status: Tidak Terhubung"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {btPrinter.connected && (
                    <Button variant="outline" onClick={handleTestPrint}>
                      <Printer className="w-4 h-4 mr-2" />
                      Tes Cetak
                    </Button>
                  )}
                  {btPrinter.connected ? (
                    <Button variant="destructive" onClick={handleDisconnectPrinter}>
                      Putuskan
                    </Button>
                  ) : (
                    <Button onClick={handleConnectPrinter}>
                      <Bluetooth className="w-4 h-4 mr-2" />
                      Hubungkan
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Fitur ini menggunakan Web Bluetooth — butuh Chrome (Android/Desktop) atau Edge, dengan HTTPS.</p>
                <p>• Aktifkan Bluetooth & izin Lokasi di HP, lalu nyalakan printer thermal Anda.</p>
                <p>• Jika aplikasi dibuka dalam wrapper/WebView, pastikan wrapper-nya berbasis Chrome Custom Tabs / TWA agar Web Bluetooth aktif. WebView Android standar tidak mendukung Web Bluetooth.</p>
                <p>• Mendukung printer ESC/POS umum (Xprinter, RPP02N, Goojprt, dll.) dengan kertas 58mm.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                <CardTitle>Desain Struk Nota</CardTitle>
              </div>
              <CardDescription>Kustomisasi tampilan struk belanja Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="logo">Logo Toko</Label>
                <div className="mt-2 flex items-center gap-4">
                  {settings.receiptLogo && (
                    <img 
                      src={settings.receiptLogo} 
                      alt="Logo" 
                      className="w-20 h-20 object-contain border rounded"
                    />
                  )}
                  <div>
                    <input
                      type="file"
                      id="logo"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => document.getElementById('logo')?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {settings.receiptLogo ? "Ganti Logo" : "Upload Logo"}
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Informasi Kontak</h3>
                
                <div>
                  <Label htmlFor="receiptPhone">Nomor Telepon</Label>
                  <Input
                    id="receiptPhone"
                    placeholder="Contoh: 0812-3456-7890"
                    value={settings.receiptPhone}
                    onChange={(e) => handleSettingChange('receiptPhone', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="receiptWhatsapp">Nomor WhatsApp</Label>
                  <Input
                    id="receiptWhatsapp"
                    placeholder="Contoh: 0812-3456-7890"
                    value={settings.receiptWhatsapp}
                    onChange={(e) => handleSettingChange('receiptWhatsapp', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="receiptInstagram">Akun Instagram</Label>
                  <Input
                    id="receiptInstagram"
                    placeholder="Contoh: @namatoko"
                    value={settings.receiptInstagram}
                    onChange={(e) => handleSettingChange('receiptInstagram', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="receiptCustomText">Teks Tambahan</Label>
                  <Input
                    id="receiptCustomText"
                    placeholder="Contoh: Terima kasih atas kunjungan Anda!"
                    value={settings.receiptCustomText}
                    onChange={(e) => handleSettingChange('receiptCustomText', e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Preview Struk</h3>
                <div className="border rounded-lg p-6 bg-white text-black max-w-sm mx-auto font-mono text-sm">
                  {settings.receiptLogo && (
                    <div className="flex justify-center mb-4">
                      <img 
                        src={settings.receiptLogo} 
                        alt="Logo" 
                        className="w-16 h-16 object-contain"
                      />
                    </div>
                  )}
                  <div className="text-center space-y-1">
                    <p className="font-bold text-base">{settings.storeName}</p>
                    <p className="text-xs">{settings.storeAddress}</p>
                    {settings.receiptPhone && (
                      <p className="text-xs">Telp: {settings.receiptPhone}</p>
                    )}
                    {settings.receiptWhatsapp && (
                      <p className="text-xs">WA: {settings.receiptWhatsapp}</p>
                    )}
                    {settings.receiptInstagram && (
                      <p className="text-xs">IG: {settings.receiptInstagram}</p>
                    )}
                  </div>
                  <div className="border-t border-dashed border-black my-3"></div>
                  <div className="text-xs">
                    <p>Tanggal: {new Date().toLocaleDateString('id-ID')}</p>
                    <p>Waktu: {new Date().toLocaleTimeString('id-ID')}</p>
                  </div>
                  <div className="border-t border-dashed border-black my-3"></div>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Produk A x1</span>
                      <span>Rp 10.000</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Produk B x2</span>
                      <span>Rp 20.000</span>
                    </div>
                  </div>
                  <div className="border-t border-dashed border-black my-3"></div>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>Rp 30.000</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>TOTAL:</span>
                      <span>Rp 30.000</span>
                    </div>
                  </div>
                  <div className="border-t border-dashed border-black my-3"></div>
                  <div className="text-center text-xs space-y-1">
                    <p>{settings.receiptFooter}</p>
                    {settings.receiptCustomText && (
                      <p>{settings.receiptCustomText}</p>
                    )}
                  </div>
                </div>
              </div>


              <Separator />

              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={handleTestPrintReceipt}
                  disabled={!btPrinter.connected}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Tes Print Struk
                </Button>
                <Button
                  onClick={handleSaveReceiptDesign}
                  className="bg-gradient-primary hover:bg-primary/90"
                >
                  Simpan Perubahan
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <CardTitle>Pengaturan Notifikasi</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                   <h4 className="text-sm font-medium text-foreground">Peringatan Stok Rendah</h4>
                   <p className="text-xs text-muted-foreground">Dapatkan notifikasi saat inventori hampir habis</p>
                </div>
                <Switch
                  checked={settings.lowStockAlerts}
                  onCheckedChange={(checked) => handleSettingChange('lowStockAlerts', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Notifikasi Penjualan</h4>
                  <p className="text-xs text-muted-foreground">Terima notifikasi untuk transaksi penjualan baru</p>
                </div>
                <Switch
                  checked={settings.salesNotifications}
                  onCheckedChange={(checked) => handleSettingChange('salesNotifications', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Laporan Email</h4>
                  <p className="text-xs text-muted-foreground">Kirim laporan penjualan harian via email</p>
                </div>
                <Switch
                  checked={settings.emailReports}
                  onCheckedChange={(checked) => handleSettingChange('emailReports', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <CardTitle>Pengaturan Keamanan</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Wajib Login untuk Penjualan</h4>
                  <p className="text-xs text-muted-foreground">Pengguna harus login untuk memproses penjualan</p>
                </div>
                <Switch
                  checked={settings.requireLoginForSales}
                  onCheckedChange={(checked) => handleSettingChange('requireLoginForSales', checked)}
                />
              </div>

              <div>
                <Label htmlFor="sessionTimeout">Batas Waktu Sesi (menit)</Label>
                <Input
                  id="sessionTimeout"
                  type="number"
                  value={settings.sessionTimeout}
                  onChange={(e) => handleSettingChange('sessionTimeout', e.target.value)}
                  className="max-w-32"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Aktifkan Log Audit</h4>
                  <p className="text-xs text-muted-foreground">Lacak semua aktivitas pengguna untuk keamanan</p>
                </div>
                <Switch
                  checked={settings.enableAuditLog}
                  onCheckedChange={(checked) => handleSettingChange('enableAuditLog', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tema Warna</CardTitle>
              <CardDescription>
                Pilih skema warna aplikasi. Preferensi disimpan pada akun Anda.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {THEMES.map((t) => {
                  const active = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={themeSaving}
                      onClick={async () => {
                        if (active) return;
                        setThemeSaving(true);
                        try {
                          await setTheme(t.id);
                          toast({
                            title: "Tema Diperbarui",
                            description: `${t.name} aktif dan tersimpan.`,
                          });
                        } catch (e: any) {
                          toast({
                            title: "Gagal Mengubah Tema",
                            description: e?.message || "Tidak bisa menyimpan preferensi tema.",
                            variant: "destructive",
                          });
                        } finally {
                          setThemeSaving(false);
                        }
                      }}
                      className={`text-left rounded-lg border p-4 transition-colors ${
                        active ? "border-primary ring-2 ring-ring" : "border-border hover:bg-accent"
                      } ${themeSaving ? "opacity-70 cursor-wait" : ""}`}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        {t.swatch.map((c, i) => (
                          <span
                            key={i}
                            className="h-6 w-6 rounded-full border border-border"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{t.name}</span>
                        {active && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                <CardTitle>Informasi Sistem</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Versi Aplikasi</h4>
                  <p className="text-sm text-muted-foreground">v1.0.0</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Status Database</h4>
                  <p className="text-sm text-success">Terhubung</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Pencadangan Terakhir</h4>
                  <p className="text-sm text-muted-foreground">Hari ini pukul 03:00</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Penyimpanan Terpakai</h4>
                  <p className="text-sm text-muted-foreground">2,4 GB / 10 GB</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Tindakan Pemeliharaan</h3>
                
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline">
                    Cadangkan Database
                  </Button>
                  <Button variant="outline">
                    Bersihkan Cache
                  </Button>
                  <Button variant="outline">
                    Ekspor Data
                  </Button>
                  <Button variant="destructive" className="ml-auto">
                    Reset Sistem
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
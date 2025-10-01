import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Store, Users, CreditCard, Bell, Shield, Database, User as UserIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export default function Settings() {
  const [loading, setLoading] = useState(false);
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
        .single();
      
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
      case 'owner':
        return 'default';
      case 'store_keeper':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Pemilik (Owner)';
      case 'store_keeper':
        return 'Penjaga Toko (Store Keeper)';
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
    receiptFooter: "Thank you for your business!",
    
    // Notifications
    lowStockAlerts: true,
    salesNotifications: true,
    emailReports: false,
    
    // Security
    requireLoginForSales: true,
    sessionTimeout: "60",
    enableAuditLog: true,
  });

  const handleSave = async () => {
    setLoading(true);
    
    // Simulate save operation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Success",
      description: "Settings saved successfully",
    });
    
    setLoading(false);
  };

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Configure your store and application preferences</p>
        </div>
        <Button 
          className="bg-gradient-primary hover:bg-primary/90"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* User Info Card */}
      <Card className="bg-gradient-card border-border/50">
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
                  <Badge variant={getRoleBadgeVariant(userProfile?.role || 'store_keeper')} className="text-sm">
                    {getRoleLabel(userProfile?.role || 'store_keeper')}
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
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="store">Store</TabsTrigger>
          <TabsTrigger value="notifications">Alerts</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="store" className="space-y-6">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" />
                <CardTitle>Store Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="storeName">Store Name</Label>
                  <Input
                    id="storeName"
                    value={settings.storeName}
                    onChange={(e) => handleSettingChange('storeName', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="storeEmail">Email Address</Label>
                  <Input
                    id="storeEmail"
                    type="email"
                    value={settings.storeEmail}
                    onChange={(e) => handleSettingChange('storeEmail', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="storeAddress">Address</Label>
                <Input
                  id="storeAddress"
                  value={settings.storeAddress}
                  onChange={(e) => handleSettingChange('storeAddress', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="storePhone">Phone Number</Label>
                  <Input
                    id="storePhone"
                    value={settings.storePhone}
                    onChange={(e) => handleSettingChange('storePhone', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={settings.currency}
                    onChange={(e) => handleSettingChange('currency', e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Tax & Receipt Settings</h3>
                
                <div>
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    step="0.01"
                    value={settings.taxRate}
                    onChange={(e) => handleSettingChange('taxRate', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="receiptFooter">Receipt Footer Message</Label>
                  <Input
                    id="receiptFooter"
                    value={settings.receiptFooter}
                    onChange={(e) => handleSettingChange('receiptFooter', e.target.value)}
                    placeholder="Message to show on receipt footer"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <CardTitle>Notification Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Low Stock Alerts</h4>
                  <p className="text-xs text-muted-foreground">Get notified when inventory is running low</p>
                </div>
                <Switch
                  checked={settings.lowStockAlerts}
                  onCheckedChange={(checked) => handleSettingChange('lowStockAlerts', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Sales Notifications</h4>
                  <p className="text-xs text-muted-foreground">Receive alerts for new sales transactions</p>
                </div>
                <Switch
                  checked={settings.salesNotifications}
                  onCheckedChange={(checked) => handleSettingChange('salesNotifications', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Email Reports</h4>
                  <p className="text-xs text-muted-foreground">Send daily sales reports via email</p>
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
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <CardTitle>Security Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">Require Login for Sales</h4>
                  <p className="text-xs text-muted-foreground">Users must login to process sales</p>
                </div>
                <Switch
                  checked={settings.requireLoginForSales}
                  onCheckedChange={(checked) => handleSettingChange('requireLoginForSales', checked)}
                />
              </div>

              <div>
                <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
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
                  <h4 className="text-sm font-medium text-foreground">Enable Audit Log</h4>
                  <p className="text-xs text-muted-foreground">Track all user actions for security</p>
                </div>
                <Switch
                  checked={settings.enableAuditLog}
                  onCheckedChange={(checked) => handleSettingChange('enableAuditLog', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                <CardTitle>System Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Application Version</h4>
                  <p className="text-sm text-muted-foreground">v1.0.0</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Database Status</h4>
                  <p className="text-sm text-success">Connected</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Last Backup</h4>
                  <p className="text-sm text-muted-foreground">Today at 3:00 AM</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Storage Used</h4>
                  <p className="text-sm text-muted-foreground">2.4 GB / 10 GB</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Maintenance Actions</h3>
                
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline">
                    Backup Database
                  </Button>
                  <Button variant="outline">
                    Clear Cache
                  </Button>
                  <Button variant="outline">
                    Export Data
                  </Button>
                  <Button variant="destructive" className="ml-auto">
                    Reset System
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
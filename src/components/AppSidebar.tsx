import { useState, useEffect } from "react"
import { LayoutDashboard, Package, ShoppingCart, Warehouse, Users, BarChart3, Settings, LogOut, UserCheck, Receipt, Tag, ClipboardList, FileText, Store, ChevronsUpDown, ArrowRightLeft, Wallet, ShoppingBag, Coins, History } from "lucide-react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useStore } from "@/contexts/StoreContext"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

const allMenuItems = [
  { title: "Dasbor", url: "/", icon: LayoutDashboard, roles: ["owner"] },
  { title: "Produk", url: "/products", icon: Package, roles: ["owner"] },
  { title: "Penjualan", url: "/sales", icon: ShoppingCart, roles: ["owner", "cashier"] },
  { title: "Inventori", url: "/inventory", icon: Warehouse, roles: ["owner"] },
  { title: "Laporan Pembelian", url: "/purchase-report", icon: FileText, roles: ["owner"] },
  { title: "Mutasi Stok", url: "/stock-transfer", icon: ArrowRightLeft, roles: ["owner"] },
  { title: "Audit Penyesuaian", url: "/stock-adjustment-report", icon: ClipboardList, roles: ["owner"] },
  { title: "Riwayat Stok", url: "/stock-history", icon: History, roles: ["owner"] },
  { title: "Member", url: "/members", icon: UserCheck, roles: ["owner", "cashier"] },
  { title: "Diskon", url: "/discounts", icon: Tag, roles: ["owner"] },
  { title: "Riwayat Transaksi", url: "/transaction-history", icon: Receipt, roles: ["owner", "cashier"] },
  { title: "Setoran Kas", url: "/cash-deposits", icon: Wallet, roles: ["owner", "cashier"] },
  { title: "Belanja Toko", url: "/store-expenses", icon: ShoppingBag, roles: ["owner", "cashier"] },
  { title: "Penjualan Lain-lain", url: "/other-sales", icon: Coins, roles: ["owner", "cashier"] },
  { title: "Kehadiran", url: "/attendance", icon: UserCheck, roles: ["owner", "cashier"] },
  { title: "Laporan", url: "/reports", icon: BarChart3, roles: ["owner"] },
  { title: "Pengguna", url: "/users", icon: Users, roles: ["owner"] },
  { title: "Pengaturan", url: "/settings", icon: Settings, roles: ["owner", "cashier"] },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const { signOut, user, userName } = useAuth()
  const { stores, currentStore, setCurrentStore, userStoreRole } = useStore()
  const { toast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const currentPath = location.pathname
  const collapsed = state === "collapsed"
  const [menuItems, setMenuItems] = useState<typeof allMenuItems>([])

  useEffect(() => {
    if (userStoreRole) {
      const filteredItems = allMenuItems.filter(item => item.roles.includes(userStoreRole));
      setMenuItems(filteredItems);
    } else {
      setMenuItems(allMenuItems.filter(item => item.roles.includes('cashier')));
    }
  }, [userStoreRole]);

  const handleLogout = async () => {
    try {
      await signOut()
      toast({ title: "Berhasil", description: "Berhasil keluar!" })
    } catch (error) {
      toast({ title: "Gagal", description: "Gagal keluar", variant: "destructive" })
    }
  }

  const handleSwitchStore = (store: any) => {
    setCurrentStore(store);
    navigate("/");
    window.location.reload();
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-gradient-card border-r border-border/50">
        {/* Store Switcher */}
        <div className="p-4 border-b border-border/50">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full">
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Store className="w-5 h-5 text-primary" />
                </div>
                {!collapsed && (
                  <>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {currentStore?.name || "Pilih Toko"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {userStoreRole === 'owner' ? 'Owner' : 'Karyawan'}
                      </p>
                    </div>
                    <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
                  </>
                )}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {stores.map((store) => (
                <DropdownMenuItem
                  key={store.id}
                  onClick={() => handleSwitchStore(store)}
                  className={store.id === currentStore?.id ? "bg-primary/10 font-semibold" : ""}
                >
                  <Store className="w-4 h-4 mr-2" />
                  {store.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/select-store")}>
                <Settings className="w-4 h-4 mr-2" />
                Kelola Toko
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            Navigasi Utama
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <NavLink
                    to={item.url}
                    className={({ isActive }) =>
                      `${isActive
                        ? "bg-gradient-primary text-white font-medium shadow-elegant"
                        : "text-white/80 hover:text-white hover:bg-white/10"} flex items-center w-full px-3 py-2 rounded-md transition-all duration-200`
                    }
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span className="ml-3">{item.title}</span>}
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Footer */}
        <div className="mt-auto p-4 border-t border-border/50">
          <div className={collapsed ? "space-y-2" : "space-y-3"}>
            {!collapsed && user && (
              <div className="px-2">
                <p className="text-xs text-muted-foreground">Masuk sebagai:</p>
                <p className="text-sm font-medium text-foreground truncate">
                  {userName || user.email}
                </p>
                {userName && (
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                )}
              </div>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={handleLogout}
                className="hover:bg-destructive/20 hover:text-destructive transition-colors"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="ml-3">Keluar</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  )
}

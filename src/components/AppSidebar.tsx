import { useState, useEffect } from "react"
import { LayoutDashboard, Package, ShoppingCart, Warehouse, Users, BarChart3, Settings, LogOut, UserCheck, Receipt, Tag, ClipboardList, FileText, Store, ChevronsUpDown, ArrowRightLeft, Wallet, ShoppingBag, Coins, History } from "lucide-react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useStore } from "@/contexts/StoreContext"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { hasUnsavedChanges } from "@/lib/unsavedChanges"

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
  { title: "Dasbor", url: "/", icon: LayoutDashboard, roles: ["owner"], group: "Operasional" },
  { title: "Penjualan", url: "/sales", icon: ShoppingCart, roles: ["owner", "cashier"], group: "Operasional" },
  { title: "Riwayat Transaksi", url: "/transaction-history", icon: Receipt, roles: ["owner", "cashier"], group: "Operasional" },
  { title: "Kehadiran", url: "/attendance", icon: UserCheck, roles: ["owner", "cashier"], group: "Operasional" },

  { title: "Produk", url: "/products", icon: Package, roles: ["owner"], group: "Inventori" },
  { title: "Inventori", url: "/inventory", icon: Warehouse, roles: ["owner"], group: "Inventori" },
  { title: "Laporan Pembelian", url: "/purchase-report", icon: FileText, roles: ["owner"], group: "Inventori" },
  { title: "Mutasi Stok", url: "/stock-transfer", icon: ArrowRightLeft, roles: ["owner"], group: "Inventori" },
  { title: "Audit Penyesuaian", url: "/stock-adjustment-report", icon: ClipboardList, roles: ["owner"], group: "Inventori" },
  { title: "Riwayat Stok", url: "/stock-history", icon: History, roles: ["owner"], group: "Inventori" },

  { title: "Setoran Kas", url: "/cash-deposits", icon: Wallet, roles: ["owner", "cashier"], group: "Keuangan & Laporan" },
  { title: "Belanja Toko", url: "/store-expenses", icon: ShoppingBag, roles: ["owner", "cashier"], group: "Keuangan & Laporan" },
  { title: "Penjualan Lain-lain", url: "/other-sales", icon: Coins, roles: ["owner", "cashier"], group: "Keuangan & Laporan" },
  { title: "Laporan", url: "/reports", icon: BarChart3, roles: ["owner"], group: "Keuangan & Laporan" },

  { title: "Member", url: "/members", icon: UserCheck, roles: ["owner", "cashier"], group: "Administrasi" },
  { title: "Diskon", url: "/discounts", icon: Tag, roles: ["owner"], group: "Administrasi" },
  { title: "Pengguna", url: "/users", icon: Users, roles: ["owner"], group: "Administrasi" },
  { title: "Pengaturan", url: "/settings", icon: Settings, roles: ["owner", "cashier"], group: "Administrasi" },
]

const GROUP_ORDER = ["Operasional", "Inventori", "Keuangan & Laporan", "Administrasi"]

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

  const groupedItems = GROUP_ORDER
    .map((group) => ({ group, items: menuItems.filter((item) => item.group === group) }))
    .filter((g) => g.items.length > 0)


  const handleLogout = async () => {
    try {
      await signOut()
      toast({ title: "Berhasil", description: "Berhasil keluar!" })
    } catch (error) {
      toast({ title: "Gagal", description: "Gagal keluar", variant: "destructive" })
    }
  }

  const handleSwitchStore = async (store: any) => {
    if (store?.id === currentStore?.id) return;
    if (hasUnsavedChanges()) {
      const ok = window.confirm(
        "Ada data yang belum disimpan di halaman ini. Ganti toko sekarang?"
      );
      if (!ok) return;
    }
    // No hard reload: the store context change re-renders pages with the new store.
    await setCurrentStore(store);
    navigate("/");
  }


  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-sidebar border-r border-sidebar-border safe-top safe-bottom">
        {/* Store Switcher */}
        <div className="p-3 border-b border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring" aria-label="Ganti toko">
              <div className="flex items-center gap-3 p-2 rounded-md hover:bg-sidebar-accent transition-colors duration-150">
                <div className="w-9 h-9 bg-primary/15 rounded-md flex items-center justify-center flex-shrink-0">
                  <Store className="w-5 h-5 text-primary" />
                </div>
                {!collapsed && (
                  <>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold text-sidebar-accent-foreground truncate">
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
        {groupedItems.map(({ group, items }) => (
          <SidebarGroup key={group} className="py-1">
            <SidebarGroupLabel className={collapsed ? "sr-only" : "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"}>
              {group}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <NavLink
                      to={item.url}
                      title={collapsed ? item.title : undefined}
                      className={({ isActive }) =>
                        `${isActive
                          ? "bg-primary/15 text-primary font-medium border-l-2 border-primary"
                          : "text-sidebar-foreground border-l-2 border-transparent hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"} flex items-center w-full min-h-10 px-3 py-2 rounded-md transition-colors duration-150`
                      }
                    >
                      <item.icon className="w-[18px] h-[18px] flex-shrink-0" aria-hidden="true" />
                      {collapsed ? (
                        <span className="sr-only">{item.title}</span>
                      ) : (
                        <span className="ml-3 text-sm truncate">{item.title}</span>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}


        {/* Footer */}
        <div className="mt-auto p-3 border-t border-sidebar-border">
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

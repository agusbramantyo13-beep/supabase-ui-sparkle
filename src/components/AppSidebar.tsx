import { useState, useEffect } from "react"
import { LayoutDashboard, Package, ShoppingCart, Warehouse, Users, BarChart3, Settings, LogOut, UserCheck, Receipt, Tag } from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

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
  { title: "Kategori", url: "/categories", icon: Package, roles: ["owner"] },
  { title: "Penjualan", url: "/sales", icon: ShoppingCart, roles: ["owner", "store_keeper"] },
  { title: "Inventori", url: "/inventory", icon: Warehouse, roles: ["owner"] },
  { title: "Member", url: "/members", icon: UserCheck, roles: ["owner", "store_keeper"] },
  { title: "Diskon", url: "/discounts", icon: Tag, roles: ["owner"] },
  { title: "Riwayat Transaksi", url: "/transaction-history", icon: Receipt, roles: ["owner", "store_keeper"] },
  { title: "Kehadiran", url: "/attendance", icon: UserCheck, roles: ["owner", "store_keeper"] },
  { title: "Laporan", url: "/reports", icon: BarChart3, roles: ["owner"] },
  { title: "Pengguna", url: "/users", icon: Users, roles: ["owner"] },
  { title: "Pengaturan", url: "/settings", icon: Settings, roles: ["owner", "store_keeper"] },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const { signOut, user, userName } = useAuth()
  const { toast } = useToast()
  const location = useLocation()
  const currentPath = location.pathname
  const collapsed = state === "collapsed"
  const [userRole, setUserRole] = useState<string | null>(null)
  const [menuItems, setMenuItems] = useState<typeof allMenuItems>([])

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching user role:', error);
        }

        const role = (data?.role as string) || 'store_keeper';
        setUserRole(role);

        const filteredItems = allMenuItems.filter(item => item.roles.includes(role));
        setMenuItems(filteredItems);
      } catch (err) {
        console.error('Unexpected error fetching user role:', err);
        setUserRole('store_keeper');
        setMenuItems(allMenuItems.filter(item => item.roles.includes('store_keeper')));
      }
    };

    fetchUserRole();
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut()
      toast({
        title: "Berhasil",
        description: "Berhasil keluar!",
      })
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Gagal keluar",
        variant: "destructive",
      })
    }
  }

  const isActive = (path: string) => {
    if (path === "/" && currentPath === "/") return true
    if (path !== "/" && currentPath.startsWith(path)) return true
    return false
  }

  const getNavCls = (path: string) =>
    isActive(path) 
      ? "bg-gradient-primary text-primary-foreground font-medium shadow-elegant" 
      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all duration-200"

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-gradient-card border-r border-border/50">
        {/* Header */}
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div>
                <h2 className="text-lg font-semibold text-foreground">KENZHO</h2>
                <p className="text-xs text-muted-foreground">POS & Inventory</p>
              </div>
            )}
          </div>
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
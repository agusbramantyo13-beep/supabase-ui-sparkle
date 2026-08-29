import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useStore } from "@/contexts/StoreContext";

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[]; // e.g. ["owner"], ["owner","cashier"]
}

export function RoleBasedRoute({ children, allowedRoles }: RoleBasedRouteProps) {
  const { userStoreRole, roleResolved, roleError, initialized, refreshStores } = useStore();

  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // A failed fetch is NOT proof that the user lacks access — never kick them
  // out (and never unmount their open forms) because of a network blip.
  if (roleError && !roleResolved) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">
          Gagal memuat hak akses. Periksa koneksi Anda.
        </p>
        <Button variant="outline" onClick={() => refreshStores()}>
          Coba lagi
        </Button>
      </div>
    );
  }

  if (!roleResolved) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!userStoreRole || !allowedRoles.includes(userStoreRole)) {
    return <Navigate to="/sales" replace />;
  }

  return <>{children}</>;
}

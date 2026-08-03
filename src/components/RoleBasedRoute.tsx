import { Navigate } from "react-router-dom";
import { useStore } from "@/contexts/StoreContext";

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[]; // e.g. ["owner"], ["owner","cashier"]
}

export function RoleBasedRoute({ children, allowedRoles }: RoleBasedRouteProps) {
  const { userStoreRole, loading } = useStore();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!userStoreRole || !allowedRoles.includes(userStoreRole)) {
    return <Navigate to="/sales" replace />;
  }

  return <>{children}</>;
}

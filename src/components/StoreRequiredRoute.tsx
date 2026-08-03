import { Navigate } from "react-router-dom";
import { useStore } from "@/contexts/StoreContext";

interface StoreRequiredRouteProps {
  children: React.ReactNode;
}

export function StoreRequiredRoute({ children }: StoreRequiredRouteProps) {
  const { currentStore, loading, stores } = useStore();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!currentStore || stores.length === 0) {
    return <Navigate to="/select-store" replace />;
  }

  return <>{children}</>;
}

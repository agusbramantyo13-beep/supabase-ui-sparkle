import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/contexts/StoreContext";
import { supabase } from "@/integrations/supabase/client";

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[]; // 'owner' | 'cashier' | 'developer'
}

export function RoleBasedRoute({ children, allowedRoles }: RoleBasedRouteProps) {
  const { user } = useAuth();
  const { userStoreRole } = useStore();
  const [isDeveloper, setIsDeveloper] = useState<boolean | null>(null);

  useEffect(() => {
    const fetch = async () => {
      if (!user) { setIsDeveloper(false); return; }
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      setIsDeveloper(data?.role === 'developer');
    };
    fetch();
  }, [user]);

  if (isDeveloper === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (isDeveloper) return <>{children}</>;

  if (!userStoreRole || !allowedRoles.includes(userStoreRole)) {
    return <Navigate to="/sales" replace />;
  }

  return <>{children}</>;
}

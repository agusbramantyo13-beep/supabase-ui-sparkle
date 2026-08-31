import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Store {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  created_at: string | null;
  receipt_footer?: string | null;
  receipt_logo?: string | null;
  receipt_phone?: string | null;
  receipt_whatsapp?: string | null;
  receipt_instagram?: string | null;
  receipt_custom_text?: string | null;
}


interface StoreContextType {
  stores: Store[];
  currentStore: Store | null;
  currentStoreId: string | null;
  loading: boolean;
  /** True once the first fetch cycle has completed (success or failure). */
  initialized: boolean;
  /** True when we have positively determined the user's role for the store. */
  roleResolved: boolean;
  /** True when the last role/stores fetch failed (network/RLS error). */
  roleError: boolean;
  setCurrentStore: (store: Store) => void | Promise<void>;
  refreshStores: () => Promise<void>;
  userStoreRole: string | null;
}


const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function useStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}

const STORE_KEY = "kenzho_current_store_id";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [currentStore, setCurrentStoreState] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [roleResolved, setRoleResolved] = useState(false);
  const [roleError, setRoleError] = useState(false);
  const [userStoreRole, setUserStoreRole] = useState<string | null>(null);

  const fetchStores = async () => {
    if (!user) {
      setStores([]);
      setCurrentStoreState(null);
      setUserStoreRole(null);
      setRoleResolved(false);
      setRoleError(false);
      setLoading(false);
      setInitialized(true);
      return;
    }

    setLoading(true);

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      setRoleError(true);
      setLoading(false);
      setInitialized(true);
      return;
    }

    const isDev = profileData?.role === 'developer';

    const { data: storesData, error: storesError } = await supabase
      .from('stores')
      .select('*')
      .order('name');

    if (storesError) {
      console.error('Error fetching stores:', storesError);
      // Keep whatever we already had; a failed refetch must not log the user
      // out of the current page or clear the resolved role.
      setRoleError(true);
      setLoading(false);
      setInitialized(true);
      return;
    }

    setRoleError(false);

    const unique = (storesData || []).filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);
    setStores(unique);

    if (unique.length === 0) {
      setCurrentStoreState(null);
      setUserStoreRole(null);
      setRoleResolved(true);
      setLoading(false);
      setInitialized(true);
      return;
    }

    const savedStoreId = localStorage.getItem(STORE_KEY);
    const savedStore = unique.find(s => s.id === savedStoreId);
    const selectedStore = savedStore || unique[0];

    setCurrentStoreState(selectedStore);
    localStorage.setItem(STORE_KEY, selectedStore.id);

    if (isDev) {
      setUserStoreRole('owner');
      setRoleResolved(true);
    } else {
      const { data: membership, error: membershipError } = await supabase
        .from('store_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('store_id', selectedStore.id)
        .maybeSingle();

      if (membershipError) {
        console.error('Error fetching membership:', membershipError);
        setRoleError(true);
      } else {
        setUserStoreRole(membership?.role || null);
        setRoleResolved(true);
      }
    }

    setLoading(false);
    setInitialized(true);
  };

  useEffect(() => {
    fetchStores();
  }, [user]);

  const setCurrentStore = async (store: Store) => {
    setCurrentStoreState(store);
    localStorage.setItem(STORE_KEY, store.id);

    if (!user) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profileData?.role === 'developer') {
      setUserStoreRole('owner');
      setRoleResolved(true);
      return;
    }

    const { data, error } = await supabase
      .from('store_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('store_id', store.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching membership:', error);
      setRoleError(true);
      return;
    }

    setRoleError(false);
    setUserStoreRole(data?.role || null);
    setRoleResolved(true);
  };

  const value: StoreContextType = {
    stores,
    currentStore,
    currentStoreId: currentStore?.id || null,
    loading,
    initialized,
    roleResolved,
    roleError,
    setCurrentStore,
    refreshStores: fetchStores,
    userStoreRole,
  };


  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

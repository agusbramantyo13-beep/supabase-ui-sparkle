import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Store {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  created_at: string | null;
}

interface StoreContextType {
  stores: Store[];
  currentStore: Store | null;
  currentStoreId: string | null;
  loading: boolean;
  setCurrentStore: (store: Store) => void;
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
  const [userStoreRole, setUserStoreRole] = useState<string | null>(null);

  const fetchStores = async () => {
    if (!user) {
      setStores([]);
      setCurrentStoreState(null);
      setUserStoreRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Check developer status
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    const isDev = profileData?.role === 'developer';

    // Fetch stores (RLS returns all for developer, only member stores otherwise)
    const { data: storesData, error: storesError } = await supabase
      .from('stores')
      .select('*')
      .order('name');

    if (storesError) {
      console.error('Error fetching stores:', storesError);
      setLoading(false);
      return;
    }

    const unique = (storesData || []).filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);
    setStores(unique);

    if (unique.length === 0) {
      setCurrentStoreState(null);
      setUserStoreRole(null);
      setLoading(false);
      return;
    }

    // Restore last selected store or pick first
    const savedStoreId = localStorage.getItem(STORE_KEY);
    const savedStore = unique.find(s => s.id === savedStoreId);
    const selectedStore = savedStore || unique[0];

    setCurrentStoreState(selectedStore);
    localStorage.setItem(STORE_KEY, selectedStore.id);

    if (isDev) {
      setUserStoreRole('owner');
    } else {
      const { data: membership } = await supabase
        .from('store_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('store_id', selectedStore.id)
        .maybeSingle();
      setUserStoreRole(membership?.role || null);
    }

    setLoading(false);
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
      return;
    }

    const { data } = await supabase
      .from('store_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('store_id', store.id)
      .maybeSingle();
    setUserStoreRole(data?.role || null);
  };

  const value: StoreContextType = {
    stores,
    currentStore,
    currentStoreId: currentStore?.id || null,
    loading,
    setCurrentStore,
    refreshStores: fetchStores,
    userStoreRole,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

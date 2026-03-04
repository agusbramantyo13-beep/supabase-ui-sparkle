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
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Get stores user belongs to
    const { data: memberData, error: memberError } = await supabase
      .from('store_members')
      .select('store_id, role')
      .eq('user_id', user.id);

    if (memberError) {
      console.error('Error fetching store memberships:', memberError);
      setLoading(false);
      return;
    }

    if (!memberData || memberData.length === 0) {
      setStores([]);
      setCurrentStoreState(null);
      setLoading(false);
      return;
    }

    const storeIds = memberData.map(m => m.store_id);
    const { data: storesData, error: storesError } = await supabase
      .from('stores')
      .select('*')
      .in('id', storeIds)
      .order('name');

    if (storesError) {
      console.error('Error fetching stores:', storesError);
      setLoading(false);
      return;
    }

    setStores(storesData || []);

    // Restore last selected store or pick first
    const savedStoreId = localStorage.getItem(STORE_KEY);
    const savedStore = storesData?.find(s => s.id === savedStoreId);
    const selectedStore = savedStore || storesData?.[0] || null;
    
    if (selectedStore) {
      setCurrentStoreState(selectedStore);
      localStorage.setItem(STORE_KEY, selectedStore.id);
      
      // Set role for this store
      const membership = memberData.find(m => m.store_id === selectedStore.id);
      setUserStoreRole(membership?.role || null);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchStores();
  }, [user]);

  const setCurrentStore = (store: Store) => {
    setCurrentStoreState(store);
    localStorage.setItem(STORE_KEY, store.id);
    
    // Refresh role for new store
    if (user) {
      supabase
        .from('store_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('store_id', store.id)
        .maybeSingle()
        .then(({ data }) => {
          setUserStoreRole(data?.role || null);
        });
    }
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

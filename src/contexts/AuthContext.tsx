import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userName: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Always keep session fresh (token refresh), but only update user
        // reference when the actual user id changes. This prevents downstream
        // effects (StoreContext, data fetches) from re-running when the user
        // simply switches Chrome tabs and Supabase auto-refreshes the token.
        setSession(newSession);
        setUser((prev) => {
          const next = newSession?.user ?? null;
          if (prev?.id === next?.id) return prev;
          return next;
        });
        setLoading(false);

        // Only fetch profile name when user actually changes (sign in/out)
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          if (newSession?.user) {
            setTimeout(() => {
              supabase
                .from('profiles')
                .select('name')
                .eq('id', newSession.user.id)
                .maybeSingle()
                .then(({ data }) => {
                  setUserName(data?.name || null);
                });
            }, 0);
          }
        } else if (event === 'SIGNED_OUT') {
          setUserName(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
    }
  };

  const value = {
    user,
    session,
    loading,
    userName,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
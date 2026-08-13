import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ThemeId = "default" | "ocean" | "amber" | "slate" | "light";

export const THEMES: { id: ThemeId; name: string; description: string; swatch: string[] }[] = [
  {
    id: "default",
    name: "Default (Teal Gelap)",
    description: "Tema bawaan, nyaman untuk shift panjang",
    swatch: ["hsl(222 24% 8%)", "hsl(222 22% 11%)", "hsl(184 62% 40%)"],
  },
  {
    id: "ocean",
    name: "Dark Ocean",
    description: "Biru laut, tenang dan fokus",
    swatch: ["hsl(217 33% 9%)", "hsl(217 30% 12%)", "hsl(210 90% 55%)"],
  },
  {
    id: "amber",
    name: "Warm Amber",
    description: "Hangat dengan kontras tinggi",
    swatch: ["hsl(28 18% 8%)", "hsl(28 16% 12%)", "hsl(36 92% 52%)"],
  },
  {
    id: "slate",
    name: "Slate Mono",
    description: "Abu netral, minim distraksi",
    swatch: ["hsl(220 16% 9%)", "hsl(220 14% 13%)", "hsl(220 12% 62%)"],
  },
  {
    id: "light",
    name: "Light Teal",
    description: "Tema terang untuk siang hari",
    swatch: ["hsl(210 40% 98%)", "hsl(0 0% 100%)", "hsl(184 72% 38%)"],
  },
];

const STORAGE_KEY = "pos-theme";
const VALID = new Set(THEMES.map((t) => t.id));

function normalize(value: string | null | undefined): ThemeId {
  return value && VALID.has(value as ThemeId) ? (value as ThemeId) : "default";
}

function applyTheme(theme: ThemeId) {
  document.documentElement.setAttribute("data-theme", theme);
}

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<ThemeId>(() => {
    if (typeof window === "undefined") return "default";
    return normalize(window.localStorage.getItem(STORAGE_KEY));
  });

  // Apply immediately on mount / change (no flicker: seeded from localStorage)
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Sync from database once the user session is ready
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("theme")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const remote = normalize((data as { theme?: string }).theme);
        setThemeState(remote);
        window.localStorage.setItem(STORAGE_KEY, remote);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const setTheme = useCallback(
    async (next: ThemeId) => {
      const value = normalize(next);
      setThemeState(value);
      window.localStorage.setItem(STORAGE_KEY, value);
      if (user) {
        await supabase.from("profiles").update({ theme: value }).eq("id", user.id);
      }
    },
    [user]
  );

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

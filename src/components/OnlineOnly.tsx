import type { ReactNode } from "react";
import { WifiOff } from "lucide-react";
import { useOfflineSales } from "@/contexts/OfflineSalesContext";

export function OnlineOnly({ children }: { children: ReactNode }) {
  const { online } = useOfflineSales();
  if (online) return <>{children}</>;
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <WifiOff className="h-8 w-8 text-muted-foreground" />
      <p className="font-medium">Butuh koneksi internet</p>
      <p className="text-sm text-muted-foreground">Halaman ini tersedia kembali setelah perangkat online.</p>
    </div>
  );
}
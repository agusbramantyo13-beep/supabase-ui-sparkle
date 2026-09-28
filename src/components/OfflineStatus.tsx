import { Cloud, CloudOff, LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useOfflineSales } from "@/contexts/OfflineSalesContext";

export function OfflineStatus() {
  const { online, syncing, pendingCount } = useOfflineSales();
  const Icon = syncing ? LoaderCircle : online ? Cloud : CloudOff;
  const label = syncing ? "Menyinkronkan…" : online ? "Online" : "Offline";
  return (
    <Link to="/offline-sales" className="ml-auto" aria-label="Buka antrean penjualan offline">
      <Badge variant={online ? "secondary" : "destructive"} className="gap-1.5 whitespace-nowrap">
        <Icon className={syncing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        <span className="hidden sm:inline">{label}</span>
        {pendingCount > 0 && <span>{pendingCount}</span>}
      </Badge>
    </Link>
  );
}
import { useEffect, useState } from "react";
import { Store } from "lucide-react";
import { getStoreLogoUrl } from "@/lib/storeLogo";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StoreLogoProps {
  logoPath?: string | null;
  updatedAt?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
}

export function StoreLogo({
  logoPath,
  updatedAt,
  alt,
  className,
  iconClassName,
}: StoreLogoProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [resolving, setResolving] = useState<boolean>(!!logoPath);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setErrored(false);
    if (!logoPath) {
      setUrl(null);
      setResolving(false);
      return;
    }
    setResolving(true);
    getStoreLogoUrl(logoPath, updatedAt).then((u) => {
      if (!alive) return;
      setUrl(u);
      setResolving(false);
      if (!u) setErrored(true);
    });
    return () => {
      alive = false;
    };
  }, [logoPath, updatedAt]);

  const showPlaceholder = !logoPath || errored;
  const showSkeleton = !showPlaceholder && (resolving || !loaded);

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-primary/10 flex items-center justify-center",
        className
      )}
    >
      {showSkeleton && <Skeleton className="absolute inset-0" />}
      {url && !errored && (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn(
            "w-full h-full object-cover transition-opacity",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}
      {showPlaceholder && (
        <Store className={cn("text-primary", iconClassName ?? "w-1/2 h-1/2")} />
      )}
    </div>
  );
}

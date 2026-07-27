import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { getProductImageUrl } from "@/lib/productImage";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  imagePath?: string | null;
  updatedAt?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
}

export function ProductImage({
  imagePath,
  updatedAt,
  alt,
  className,
  iconClassName,
}: ProductImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [resolving, setResolving] = useState<boolean>(!!imagePath);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setErrored(false);
    if (!imagePath) {
      setUrl(null);
      setResolving(false);
      return;
    }
    setResolving(true);
    getProductImageUrl(imagePath, updatedAt).then((u) => {
      if (!alive) return;
      setUrl(u);
      setResolving(false);
      if (!u) setErrored(true);
    });
    return () => {
      alive = false;
    };
  }, [imagePath, updatedAt]);

  const showPlaceholder = !imagePath || errored;
  const showSkeleton = !showPlaceholder && (resolving || !loaded);

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted flex items-center justify-center",
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
        <Package
          className={cn("text-muted-foreground/50", iconClassName ?? "w-1/2 h-1/2")}
        />
      )}
    </div>
  );
}

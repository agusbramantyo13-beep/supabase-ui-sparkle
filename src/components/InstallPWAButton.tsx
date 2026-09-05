import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { CANONICAL_PWA_URL, isCanonicalPwaHost } from "@/lib/pwaConfig";

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (ua.includes("Macintosh") && (navigator as any).maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

const INSTRUCTIONS: Record<Platform, { title: string; steps: string[] }> = {
  ios: {
    title: "Install di iPhone / iPad (Safari)",
    steps: [
      'Tap ikon "Share" (kotak dengan panah ke atas) di toolbar Safari.',
      'Gulir dan pilih "Add to Home Screen" (Tambah ke Layar Utama).',
      'Tap "Add" (Tambah) di pojok kanan atas untuk menyelesaikan.',
    ],
  },
  android: {
    title: "Install di Android (Chrome)",
    steps: [
      "Tap ikon menu (titik tiga) di pojok kanan atas Chrome.",
      'Pilih "Install app" atau "Add to Home screen".',
      "Ikuti instruksi yang muncul untuk menyelesaikan instalasi.",
    ],
  },
  desktop: {
    title: "Install di Komputer",
    steps: [
      "Cari ikon install (bentuk layar dengan panah) di ujung kanan address bar.",
      'Jika tidak ada, buka menu browser (titik tiga) lalu pilih "Install KENZHO POS...".',
      'Klik "Install" untuk menyelesaikan.',
    ],
  },
};

export function InstallPWAButton() {
  const { isInstalled, canPromptInstall, promptInstall } = usePWAInstall();
  const [showInstructions, setShowInstructions] = useState(false);

  if (isInstalled) return null;

  const onCanonicalHost = isCanonicalPwaHost();
  const platform = detectPlatform();
  const info = INSTRUCTIONS[platform];

  const handleClick = async () => {
    if (!onCanonicalHost) {
      // Not on the canonical Cloudflare origin — a native install here
      // would install a PWA scoped to the wrong origin. Send the user
      // to the canonical origin instead so any install they do there
      // is the "real" KENZHO POS app.
      window.location.href = CANONICAL_PWA_URL;
      return;
    }
    if (canPromptInstall) {
      await promptInstall();
    } else {
      setShowInstructions(true);
    }
  };

  return (
    <>
      <Button onClick={handleClick} variant="outline" className="gap-2">
        <Download className="w-4 h-4" />
        {onCanonicalHost ? "Install KENZHO POS" : "Buka KENZHO POS untuk Install"}
      </Button>

      {onCanonicalHost && (
        <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{info.title}</DialogTitle>
              <DialogDescription>
                Browser ini belum mendukung install otomatis. Ikuti langkah berikut:
              </DialogDescription>
            </DialogHeader>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              {info.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

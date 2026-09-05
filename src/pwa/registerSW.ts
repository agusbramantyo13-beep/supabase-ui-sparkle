// Guarded service worker registration.
// Only registers on the canonical production origin (the Cloudflare
// Workers deployment) so there is exactly one installable KENZHO POS
// PWA. Every other origin (dev, Lovable previews, Lovable's own
// kenzhovp.lovable.app hosting, iframes, ?sw=off) is refused, and any
// stale registration left over on those origins is actively unregistered.

import { isCanonicalPwaHost } from "@/lib/pwaConfig";

const SW_URL = "/sw.js";

function isRefusedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  if (!isCanonicalPwaHost()) return true;
  return false;
}

async function unregisterMatching() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          return url.endsWith(SW_URL);
        })
        .map((r) => r.unregister()),
    );
  } catch {
    // ignore
  }
}

export function registerPWA() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  if (isRefusedContext()) {
    void unregisterMatching();
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => {
      // ignore registration failures
    });
  });
}

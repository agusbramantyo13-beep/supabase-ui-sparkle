// Tiny module-scoped store that captures the browser's native PWA
// "beforeinstallprompt" event as early as possible (at module load time,
// before React mounts) so no install opportunities are missed regardless
// of when the InstallPWAButton component happens to mount.
//
// This does NOT create a new install mechanism — it only captures and
// re-exposes the browser's own native install prompt event, and tracks
// whether the app has already been installed. The captured prompt is
// only ever exposed when running on the canonical PWA origin (see
// src/lib/pwaConfig.ts), so a native install can never be triggered
// from a non-canonical origin (e.g. Lovable's own hosting).

import { isCanonicalPwaHost } from "./pwaConfig";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type Listener = (event: BeforeInstallPromptEvent | null) => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let appInstalled = false;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener(deferredPrompt));
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    if (!isCanonicalPwaHost()) return;
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    appInstalled = true;
    deferredPrompt = null;
    notify();
  });
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function isAppInstalled(): boolean {
  return appInstalled;
}

export function clearDeferredPrompt(): void {
  deferredPrompt = null;
  notify();
}

export function subscribeToInstallPrompt(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

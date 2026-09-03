import { useCallback, useEffect, useState } from "react";
import {
  clearDeferredPrompt,
  getDeferredPrompt,
  isAppInstalled,
  subscribeToInstallPrompt,
  type BeforeInstallPromptEvent,
} from "@/lib/pwaInstallStore";

function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const displayModeStandalone = window.matchMedia?.(
    "(display-mode: standalone)"
  ).matches;
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(displayModeStandalone || iosStandalone);
}

export function usePWAInstall() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    getDeferredPrompt()
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(
    () => isAppInstalled() || isRunningStandalone()
  );

  useEffect(() => {
    if (isRunningStandalone()) setIsInstalled(true);
    const unsubscribe = subscribeToInstallPrompt((nextPrompt) => {
      setPrompt(nextPrompt);
      if (isAppInstalled()) setIsInstalled(true);
    });
    return unsubscribe;
  }, []);

  const promptInstall = useCallback(async (): Promise<
    "accepted" | "dismissed" | "unavailable"
  > => {
    if (!prompt) return "unavailable";
    await prompt.prompt();
    const choice = await prompt.userChoice;
    clearDeferredPrompt();
    if (choice.outcome === "accepted") setIsInstalled(true);
    return choice.outcome;
  }, [prompt]);

  return {
    isInstalled,
    canPromptInstall: Boolean(prompt) && !isInstalled,
    promptInstall,
  };
}

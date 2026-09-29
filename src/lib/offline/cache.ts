import { getPosCache, mergePosCache } from "./db";
import type { PosCache } from "./types";

export async function readPosCache(storeId: string) {
  return getPosCache(storeId);
}

export async function writePosCache(storeId: string, patch: Partial<PosCache>) {
  return mergePosCache(storeId, patch);
}

export async function imageUrlToDataUrl(url: string | null | undefined) {
  if (!url) return undefined;
  if (url.startsWith("data:")) return url;
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise<string | undefined>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : undefined);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}
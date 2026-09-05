import { supabase } from "@/integrations/supabase/client";

const BUCKET = "store-logos";
const MAX_WIDTH = 512;
const TARGET_BYTES = 100 * 1024; // 100KB
const MIN_QUALITY = 0.5;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

export function validateImageFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Ukuran gambar maksimal 10MB");
  }
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Gagal memuat gambar"));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export async function processImageToWebp(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_WIDTH / img.naturalWidth);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak didukung browser");
  ctx.drawImage(img, 0, 0, w, h);

  let quality = 0.85;
  let best: Blob | null = null;
  for (let i = 0; i < 6; i++) {
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/webp", quality)
    );
    if (!blob) throw new Error("Gagal mengonversi gambar ke WebP");
    if (!best || blob.size < best.size) best = blob;
    if (blob.size <= TARGET_BYTES || quality <= MIN_QUALITY) break;
    quality = Math.max(MIN_QUALITY, quality - 0.1);
  }
  if (!best) throw new Error("Gagal memproses gambar");
  return best;
}

export function storeLogoPath(storeId: string): string {
  return `${storeId}/logo.webp`;
}

export async function uploadStoreLogo(storeId: string, file: File): Promise<string> {
  validateImageFile(file);
  const blob = await processImageToWebp(file);
  const path = storeLogoPath(storeId);
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: "image/webp",
    cacheControl: "31536000",
  });
  if (error) throw error;
  urlCache.forEach((_, k) => {
    if (k.startsWith(path + "?")) urlCache.delete(k);
  });
  return path;
}

export async function deleteStoreLogo(storeId: string): Promise<void> {
  const path = storeLogoPath(storeId);
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
  urlCache.forEach((_, k) => {
    if (k.startsWith(path + "?")) urlCache.delete(k);
  });
}

// --- URL resolution (bucket privat → signed URL di-cache di memori) ---
const SIGNED_TTL = 60 * 60 * 24 * 365; // 1 tahun
const urlCache = new Map<string, Promise<string | null>>();

export function getStoreLogoUrl(
  logoPath: string | null | undefined,
  updatedAt?: string | null
): Promise<string | null> {
  if (!logoPath) return Promise.resolve(null);
  const v = updatedAt ? new Date(updatedAt).getTime() : 0;
  const key = `${logoPath}?v=${v}`;
  const cached = urlCache.get(key);
  if (cached) return cached;
  const p = (async () => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(logoPath, SIGNED_TTL);
    if (error || !data) return null;
    return `${data.signedUrl}${data.signedUrl.includes("?") ? "&" : "?"}v=${v}`;
  })();
  urlCache.set(key, p);
  return p;
}

// Single source of truth for which origin is allowed to be the "real"
// installable KENZHO POS PWA. Only this origin registers the service
// worker and offers a native install prompt; every other origin
// (Lovable's own hosting, previews, etc.) redirects users here instead.
export const CANONICAL_PWA_HOST = "kenzhopos.agusbramantyo13.workers.dev";
export const CANONICAL_PWA_URL = `https://${CANONICAL_PWA_HOST}/`;

export function isCanonicalPwaHost(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname === CANONICAL_PWA_HOST;
}

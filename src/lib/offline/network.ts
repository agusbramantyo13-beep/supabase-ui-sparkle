export function isNetworkError(error: unknown) {
  if (!navigator.onLine) return true;
  const value = error as { message?: string; name?: string; status?: number } | null;
  const text = `${value?.name || ""} ${value?.message || ""}`.toLowerCase();
  return value?.status === 0 || /fetch|network|failed to fetch|load failed|offline|timeout/.test(text);
}
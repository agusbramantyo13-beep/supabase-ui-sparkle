// Global registry of "unsaved changes" flags so that any part of the app
// (store switcher, navigation, beforeunload guard) can know whether the user
// currently has unsaved form data open.

const keys = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function setUnsavedChanges(key: string, dirty: boolean) {
  const had = keys.has(key);
  if (dirty) {
    keys.add(key);
  } else {
    keys.delete(key);
  }
  if (had !== keys.has(key)) notify();
}

export function clearUnsavedChanges(key: string) {
  setUnsavedChanges(key, false);
}

export function hasUnsavedChanges() {
  return keys.size > 0;
}

export function subscribeUnsavedChanges(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

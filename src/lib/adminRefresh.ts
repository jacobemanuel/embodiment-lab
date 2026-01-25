const ADMIN_REFRESH_EVENT = 'admin:refresh';
const ADMIN_REFRESH_STORAGE_KEY = 'admin:refresh:ts';

export const emitAdminRefresh = () => {
  if (typeof window === 'undefined') return;
  const stamp = Date.now().toString();
  window.dispatchEvent(new CustomEvent(ADMIN_REFRESH_EVENT, { detail: stamp }));
  try {
    localStorage.setItem(ADMIN_REFRESH_STORAGE_KEY, stamp);
  } catch {
    // Ignore storage failures (e.g. private mode).
  }
};

export const subscribeAdminRefresh = (handler: () => void) => {
  if (typeof window === 'undefined') return () => {};
  const onEvent = () => handler();
  const onStorage = (event: StorageEvent) => {
    if (event.key === ADMIN_REFRESH_STORAGE_KEY) handler();
  };
  window.addEventListener(ADMIN_REFRESH_EVENT, onEvent);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(ADMIN_REFRESH_EVENT, onEvent);
    window.removeEventListener('storage', onStorage);
  };
};

'use client';

import { useEffect, useState } from 'react';

const KEY = 'dimi-cms.active-site';

export function getStoredActiveSite(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredActiveSite(siteId: string) {
  if (typeof window === 'undefined') return;
  try {
    if (siteId) window.localStorage.setItem(KEY, siteId);
    else window.localStorage.removeItem(KEY);
  } catch {
    // localStorage may be blocked; ignore
  }
}

/**
 * Hook variant — returns persisted active site id and a setter.
 * Initial render returns '' to keep SSR/client output identical;
 * the stored value hydrates on the first effect pass.
 */
export function useActiveSite(): [string, (id: string) => void] {
  const [siteId, setSiteId] = useState<string>('');

  useEffect(() => {
    const initial = getStoredActiveSite();
    if (initial) setSiteId(initial);
  }, []);

  const set = (id: string) => {
    setSiteId(id);
    setStoredActiveSite(id);
  };

  return [siteId, set];
}

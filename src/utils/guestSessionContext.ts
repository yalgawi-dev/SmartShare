'use client';

import { useEffect, useState } from 'react';

export interface GuestShareSessionInfo {
  token: string;
  guestName: string;
  guestPhone?: string;
  senderName?: string;
  spaceTitle?: string;
  itemName?: string;
}

const STORAGE_KEY = 'smartshare_active_guest_share_session_v1';
const EVENT_NAME = 'smartshare:guest_share_session_changed';

export function readActiveGuestShareSession(): GuestShareSessionInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestShareSessionInfo;
    if (!parsed || !parsed.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setActiveGuestShareSession(info: GuestShareSessionInfo | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!info) {
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(info));
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // Ignore storage errors
  }
}

export function useActiveGuestShareSession(): GuestShareSessionInfo | null {
  const [session, setSession] = useState<GuestShareSessionInfo | null>(() =>
    readActiveGuestShareSession()
  );

  useEffect(() => {
    const sync = () => setSession(readActiveGuestShareSession());
    window.addEventListener(EVENT_NAME, sync);
    return () => window.removeEventListener(EVENT_NAME, sync);
  }, []);

  return session;
}

/** Extract clean first name for warm Hebrew greeting */
export function extractGuestFirstName(fullName?: string | null): string {
  if (!fullName) return '';
  const trimmed = fullName.trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0] || trimmed;
}

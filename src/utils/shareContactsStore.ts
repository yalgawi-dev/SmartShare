// Single Source of Truth (DRY) for Permanent Share Address Book & Recipient Groups.
// Saved per user in localStorage (0ms read) + non-blocking Firestore sync (`users/<uid>.savedShareDirectory`)
// so contacts and groups are reusable across ALL spaces, folders, and devices.

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RecipientRole } from '@/utils/fileShareUtils';

export interface SavedShareContact {
  id: string;
  name: string;
  phone?: string;
  role?: RecipientRole;
  createdAt: number;
}

export interface SavedShareGroup {
  id: string;
  name: string;
  icon?: string;
  contactIds: string[];
  createdAt: number;
}

export interface SavedShareDirectory {
  contacts: SavedShareContact[];
  groups: SavedShareGroup[];
  updatedAt: number;
}

const storageKey = (uid: string) => `smartshare_saved_share_dir_${uid || 'anon'}`;

export function loadSavedShareDirectorySync(uid?: string): SavedShareDirectory {
  if (typeof window === 'undefined' || !uid) {
    return { contacts: [], groups: [], updatedAt: 0 };
  }
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return { contacts: [], groups: [], updatedAt: 0 };
    const parsed = JSON.parse(raw);
    return {
      contacts: Array.isArray(parsed?.contacts) ? parsed.contacts : [],
      groups: Array.isArray(parsed?.groups) ? parsed.groups : [],
      updatedAt: Number(parsed?.updatedAt || 0),
    };
  } catch {
    return { contacts: [], groups: [], updatedAt: 0 };
  }
}

export async function loadSavedShareDirectory(uid?: string): Promise<SavedShareDirectory> {
  const local = loadSavedShareDirectorySync(uid);
  if (!uid) return local;

  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const remote = snap.data()?.savedShareDirectory as SavedShareDirectory | undefined;
      if (remote && Number(remote.updatedAt || 0) > local.updatedAt) {
        const merged: SavedShareDirectory = {
          contacts: Array.isArray(remote.contacts) ? remote.contacts : [],
          groups: Array.isArray(remote.groups) ? remote.groups : [],
          updatedAt: Number(remote.updatedAt || Date.now()),
        };
        try {
          localStorage.setItem(storageKey(uid), JSON.stringify(merged));
        } catch {}
        return merged;
      }
    }
  } catch {
    // Offline/guest gracefully falls back to local directory
  }
  return local;
}

export async function saveSavedShareDirectory(uid: string | undefined, dir: SavedShareDirectory): Promise<void> {
  if (!uid) return;
  const payload: SavedShareDirectory = {
    contacts: dir.contacts || [],
    groups: dir.groups || [],
    updatedAt: Date.now(),
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(storageKey(uid), JSON.stringify(payload));
    } catch {}
  }
  try {
    await setDoc(doc(db, 'users', uid), { savedShareDirectory: payload }, { merge: true });
  } catch {
    // Non-blocking sync
  }
}

export async function upsertSavedContact(
  uid: string | undefined,
  input: { name: string; phone?: string; role?: RecipientRole }
): Promise<SavedShareDirectory> {
  const dir = loadSavedShareDirectorySync(uid);
  const cleanName = (input.name || '').trim();
  if (!uid || !cleanName) return dir;

  const cleanPhone = (input.phone || '').trim() || undefined;
  const normName = cleanName.toLowerCase();
  const existingIdx = dir.contacts.findIndex(
    (c) =>
      c.name.toLowerCase() === normName ||
      (cleanPhone && c.phone && c.phone.replace(/\D/g, '') === cleanPhone.replace(/\D/g, ''))
  );

  const nextContacts = [...dir.contacts];
  if (existingIdx >= 0) {
    nextContacts[existingIdx] = {
      ...nextContacts[existingIdx],
      name: cleanName,
      phone: cleanPhone || nextContacts[existingIdx].phone,
      role: input.role || nextContacts[existingIdx].role,
    };
  } else {
    nextContacts.unshift({
      id: `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      phone: cleanPhone,
      role: input.role || 'client',
      createdAt: Date.now(),
    });
  }

  const nextDir: SavedShareDirectory = {
    ...dir,
    contacts: nextContacts,
    updatedAt: Date.now(),
  };
  await saveSavedShareDirectory(uid, nextDir);
  return nextDir;
}

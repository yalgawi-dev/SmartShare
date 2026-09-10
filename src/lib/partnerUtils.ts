// src/lib/partnerUtils.ts

import { db } from './firebase';
import { collection, getDocs, updateDoc } from 'firebase/firestore';

/**
 * Ensure that every member of a given space has the `canAccessCommandCenter` flag set to true.
 * This helper is used by the migration script and can be reused by UI code that updates
 * partner permissions, keeping the logic in a single place (DRY).
 */
export async function ensureCommandCenterFlag(spaceId: string) {
  const membersCol = collection(db, `spaces/${spaceId}/members`);
  const snap = await getDocs(membersCol);

  const updates = snap.docs
    .filter((m) => m.data().canAccessCommandCenter === undefined)
    .map((m) => updateDoc(m.ref, { canAccessCommandCenter: true }));

  await Promise.all(updates);
}

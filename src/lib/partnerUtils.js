// src/lib/partnerUtils.js

// CommonJS implementation of partner utils helper used by migration script.
// Mirrors the TypeScript version but uses relative imports to avoid alias issues.

const { db } = require('./firebase');
const { collection, getDocs, updateDoc } = require('firebase/firestore');

/**
 * Ensure that every member of a given space has the `canAccessCommandCenter`
 * flag set to true.
 */
async function ensureCommandCenterFlag(spaceId) {
  const membersCol = collection(db, `spaces/${spaceId}/members`);
  const snap = await getDocs(membersCol);

  const updates = snap.docs
    .filter((m) => m.data().canAccessCommandCenter === undefined)
    .map((m) => updateDoc(m.ref, { canAccessCommandCenter: true }));

  await Promise.all(updates);
}

module.exports = { ensureCommandCenterFlag };

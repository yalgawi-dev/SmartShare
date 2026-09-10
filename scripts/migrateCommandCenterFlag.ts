const { collection, getDocs, updateDoc, doc } = require('firebase/firestore');
const { db } = require('../src/lib/firebase');

(async () => {
  try {
    const spacesSnap = await getDocs(collection(db, 'spaces'));
    for (const spaceDoc of spacesSnap.docs) {
      const spaceData = spaceDoc.data();
      const members = spaceData.members;
      if (!members) continue;
      const updatedMembers = members.map(m => {
        if (m.canAccessCommandCenter === undefined) {
          return { ...m, canAccessCommandCenter: true };
        }
        return m;
      });
      if (JSON.stringify(updatedMembers) !== JSON.stringify(members)) {
        await updateDoc(doc(db, 'spaces', spaceDoc.id), { members: updatedMembers });
        console.log(`Space ${spaceDoc.id} members updated`);
      }
    }
    console.log('Migration completed');
  } catch (e) {
    console.error('Migration error', e);
  }
})();

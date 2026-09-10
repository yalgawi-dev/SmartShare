import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

async function migrate() {
  try {
    const spacesSnap = await getDocs(collection(db, 'spaces'));
    for (const spaceDoc of spacesSnap.docs) {
      const spaceData = spaceDoc.data() as any;
      const members = spaceData.members as any[] | undefined;
      if (!members) continue;
      const updatedMembers = members.map(m => {
        if (m.canAccessCommandCenter === undefined) {
          return { ...m, canAccessCommandCenter: true };
        }
        return m;
      });
      // Only write if any member changed
      if (JSON.stringify(updatedMembers) !== JSON.stringify(members)) {
        await updateDoc(doc(db, 'spaces', spaceDoc.id), { members: updatedMembers });
        console.log(`Space ${spaceDoc.id} members updated`);
      }
    }
    console.log('Migration completed');
  } catch (e) {
    console.error('Migration error', e);
  }
}

migrate();

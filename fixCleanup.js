const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

c = c.replace(
  "const defaultSettings: SpaceSettings = {",
  "const defaultSettings: SpaceSettings = {\n  pendingExpirationHours: 1,"
);

c = c.replace(
  "export interface SpaceSettings {",
  "export interface SpaceSettings {\n  pendingExpirationHours?: number;"
);

// We need to implement the cleanup logic
// Let's do it inside the onSnapshot callback so it runs on DB updates
const onSnapshotLogic = `        const dbSpaces = snapshot.docs.map(doc => {
          const data = doc.data();`;

const newOnSnapshotLogic = `        const dbSpaces = snapshot.docs.map(doc => {
          const data = doc.data();
          // Auto-cleanup expired pending members
          if (data.members) {
            const expHours = data.settings?.pendingExpirationHours || 1;
            const now = Date.now();
            let changed = false;
            const cleanMembers = data.members.filter((m: any) => {
              if (m.status === 'pending' && m.joinedAt) {
                const joined = new Date(m.joinedAt).getTime();
                if (now - joined > expHours * 60 * 60 * 1000) {
                  changed = true;
                  return false; // Remove them!
                }
              }
              return true;
            });
            if (changed) {
              // We just do it locally for this render. To do it in DB properly:
              setTimeout(() => {
                const { doc, updateDoc } = require('firebase/firestore');
                updateDoc(doc.ref, { members: cleanMembers }).catch(console.error);
              }, 1000);
              data.members = cleanMembers;
            }
          }`;

c = c.replace(onSnapshotLogic, newOnSnapshotLogic);

fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Added auto-cleanup for pending members');

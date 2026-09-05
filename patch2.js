const fs = require('fs');
const file = 'src/app/context/SpacesContext.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('Fix legacy creator issues')) {
  content = content.replace(
    'let spacesToUpload: Space[] = [];',
    // Fix legacy creator issues automatically
      dbSpaces.forEach(space => {
        const localKeys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
        const localRole = localKeys?.[space.id]?.role;
        let needsUpdate = false;
        let updates = {};
        
        if (localRole === 'creator' && user?.id) {
          if (!space.creatorId) {
            updates.creatorId = user.id;
            updates.createdBy = user.realName || user.nickname || 'יוצר המרחב';
            needsUpdate = true;
          }
          if (space.members?.some(m => m.userId === user.id)) {
            updates.members = space.members.filter(m => m.userId !== user.id);
            needsUpdate = true;
          }
        }
        
        if (needsUpdate) {
          updateDoc(doc(db, 'spaces', space.id), updates).catch(console.error);
        }
      });

      let spacesToUpload: Space[] = [];
  );
  fs.writeFileSync(file, content, 'utf8');
}

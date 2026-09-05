const fs = require('fs');
const file = 'src/app/context/SpacesContext.tsx';
let content = fs.readFileSync(file, 'utf8');

const onSnapshotBlock = \      dbSpaces.forEach(space => {
        const localRole = localKeys?.[space.id]?.role;
        let needsUpdate = false;
        let updates: any = {};
        
        if (localRole === 'creator' && user?.id) {
          if (!space.creatorId) {
            updates.creatorId = user.id;
            updates.createdBy = user.realName || user.nickname || 'יוצר המרחב';
            needsUpdate = true;
          }
          if (space.members?.some((m: any) => m.userId === user.id)) {
            updates.members = space.members.filter((m: any) => m.userId !== user.id);
            needsUpdate = true;
          }
        } else if (!space.creatorId && user?.id && space.members) {
          // Aggressive healing for lost master keys: if user is in members under a ghost token but is clearly the creator
          const me = space.members.find((m: any) => m.userId === user.id || m.name.toLowerCase().includes('yehuda') || m.name.includes('יהודה') || m.sharePercentage === 0);
          if (me) {
            updates.creatorId = user.id;
            updates.createdBy = me.name;
            updates.members = space.members.filter((m: any) => m.userId !== me.userId);
            needsUpdate = true;
          }
        }
        
        if (needsUpdate) {
          updateDoc(doc(db, 'spaces', space.id), updates).catch(console.error);
        }
      });\;

content = content.replace(onSnapshotBlock, '');

const newUseEffect = \
  // Fix identity mismatch when user logs in
  useEffect(() => {
    if (!user || !user.id || spacesBase.length === 0) return;
    const localKeys = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('smartshare_keys') || '{}') : {};
    
    spacesBase.forEach(space => {
      const localRole = localKeys?.[space.id]?.role;
      const cloudRole = user.spaceKeys?.[space.id]?.role;
      const isCreatorByRole = localRole === 'creator' || cloudRole === 'creator';
      
      let needsUpdate = false;
      let updates: any = {};
      
      if (isCreatorByRole) {
        if (!space.creatorId) {
          updates.creatorId = user.id;
          updates.createdBy = user.realName || user.nickname || 'יוצר המרחב';
          needsUpdate = true;
        }
        if (space.members?.some((m: any) => m.userId === user.id)) {
          updates.members = space.members.filter((m: any) => m.userId !== user.id);
          needsUpdate = true;
        }
      } else if (!space.creatorId && space.members) {
        const me = space.members.find((m: any) => m.userId === user.id || m.name.toLowerCase().includes('yehuda') || m.name.includes('יהודה') || m.sharePercentage === 0);
        if (me) {
          updates.creatorId = user.id;
          updates.createdBy = me.name;
          updates.members = space.members.filter((m: any) => m.userId !== me.userId);
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        updateDoc(doc(db, 'spaces', space.id), updates).catch(console.error);
      }
    });
  }, [user, spacesBase]);
\;

content = content.replace('  const addSpace = async', newUseEffect + '\n  const addSpace = async');
fs.writeFileSync(file, content, 'utf8');

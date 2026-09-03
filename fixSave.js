const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

const oldSave = `  const saveSpaceUpdate = async (spaceId: string, mutator: (space: Omit<Space, 'mediaItems'>) => Omit<Space, 'mediaItems'>) => {
    let updatedSpace: Omit<Space, 'mediaItems'> | null = null;
    
    setSpacesBase(prev => {
      return prev.map(space => {
        if (space.id === spaceId) {
          updatedSpace = mutator(space);
          return updatedSpace;
        }
        return space;
      });
    });

    if (updatedSpace) {
      try {
        await setDoc(doc(db, 'spaces', spaceId), updatedSpace);
      } catch (e) {
        console.error("Error updating Firestore space root", e);
      }
    }
  };`;

const newSave = `  const saveSpaceUpdate = async (spaceId: string, mutator: (space: Omit<Space, 'mediaItems'>) => Omit<Space, 'mediaItems'>) => {
    let targetSpace = spacesBase.find(s => s.id === spaceId);
    if (!targetSpace) return;
    
    const updatedSpace = mutator(targetSpace);
    
    try {
      await setDoc(doc(db, 'spaces', spaceId), updatedSpace);
      setSpacesBase(prev => prev.map(space => space.id === spaceId ? updatedSpace : space));
    } catch (e) {
      console.error("Error updating Firestore space root", e);
    }
  };`;

c = c.replace(oldSave, newSave);
fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Fixed saveSpaceUpdate!');

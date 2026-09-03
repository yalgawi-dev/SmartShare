const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

const oldRole = `  const getRoleForSpace = (spaceId: string): 'creator' | 'partner' | 'none' => {
    // 1. Check Auth Context (Single Source of Truth)
    if (user && user.spaceKeys && user.spaceKeys[spaceId]) {
      return user.spaceKeys[spaceId].role;
    }
    // 2. Check Local Storage (Fallback for anonymous / pre-sync users)
    if (typeof window !== 'undefined') {
      try {
        const localKeys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
        if (localKeys[spaceId]) return localKeys[spaceId].role;
      } catch(e) {}
    }
    
    // TEMPORARY FALLBACK DURING MIGRATION OF OLD SPACES: 
    const space = spacesBase.find(s => s.id === spaceId);
    if (space && !space.masterKey) {
       if ((space as any).creatorId === (user?.id || 'me') || (space as any).createdBy === (user?.id || 'me')) return 'creator';
    }
    
    return 'none';
  };`;

const newRole = `  const getRoleForSpace = (spaceId: string): 'creator' | 'partner' | 'none' => {
    // 1. Check Auth Context (Single Source of Truth)
    if (user && user.spaceKeys && user.spaceKeys[spaceId]) {
      return user.spaceKeys[spaceId].role;
    }
    // 2. Check Local Storage (Fallback for anonymous / pre-sync users)
    if (typeof window !== 'undefined') {
      try {
        const localKeys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
        if (localKeys[spaceId]) return localKeys[spaceId].role;
      } catch(e) {}
    }
    
    // 3. Robust Fallback: Check if the logged-in user matches the creatorId
    const space = spacesBase.find(s => s.id === spaceId);
    if (space) {
       if ((space as any).creatorId === user?.id || (space as any).createdBy === user?.id) {
         return 'creator';
       }
    }
    
    return 'none';
  };`;

c = c.replace(oldRole, newRole);
fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Fixed getRoleForSpace fallback');

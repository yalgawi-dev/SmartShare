const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

c = c.replace(/joinSpace: \(spaceId: string, userId: string, name: string\) => void;/g, 
  `joinSpace: (spaceId: string, userId: string, name: string) => void;\n  getRoleForSpace: (spaceId: string) => 'creator' | 'partner' | 'none';`);

c = c.replace(/export function SpacesProvider\(\{\ children\ \}: \{\ children: ReactNode\ \}\) \{/,
  `export function SpacesProvider({ children }: { children: ReactNode }) {\n  const { user } = useAuth();`);

c = c.replace(/return \(\n    <SpacesContext\.Provider value=\{\{/g, 
  `  const getRoleForSpace = (spaceId: string): 'creator' | 'partner' | 'none' => {
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
    // If the space doesn't have a masterKey, check createdBy to prevent breaking old spaces, 
    // but going forward, new spaces use the Key system.
    const space = spaces.find(s => s.id === spaceId);
    if (space && !space.masterKey) {
       if ((space as any).creatorId === (user?.id || 'me') || (space as any).createdBy === (user?.id || 'me')) return 'creator';
    }
    
    return 'none';
  };

  return (
    <SpacesContext.Provider value={{
      getRoleForSpace,`);

fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Added getRoleForSpace to SpacesContext');

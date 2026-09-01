const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

c = c.replace(
  /export function SpacesProvider\(\{ children \}: \{ children: ReactNode \}\) \{/,
  `export function SpacesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  const getRoleForSpace = (spaceId: string): 'creator' | 'partner' | 'none' => {
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
  };`
);

fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Injected getRoleForSpace successfully.');

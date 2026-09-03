const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

const target = `  const addSpace = (spaceData: Omit<Space, 'id' | 'updatedAt' | 'settings' | 'invoices' | 'mediaItems' | 'date' | 'coverImage'>) => {
    const newSpace: Omit<Space, 'mediaItems'> = {
      ...spaceData,
      id: crypto.randomUUID(),
      updatedAt: 'נוצר הרגע',
      settings: defaultSettings,
      invoices: [],
      members: [],
    };
    setSpacesBase(prev => [newSpace, ...prev]);
    setDoc(doc(db, 'spaces', newSpace.id), newSpace).catch(console.error);
  };`;

const replacement = `  const addSpace = async (spaceData: Omit<Space, 'id' | 'updatedAt' | 'settings' | 'invoices' | 'mediaItems' | 'date' | 'coverImage'>) => {
    const masterKey = 'master_' + crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const newSpace: Omit<Space, 'mediaItems'> = {
      ...spaceData,
      id: crypto.randomUUID(),
      updatedAt: 'נוצר הרגע',
      settings: defaultSettings,
      invoices: [],
      members: [],
      masterKey: masterKey,
    };
    
    // 1. Save to LocalStorage keyring (for guests / robust fallback)
    try {
      const localKeys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
      localKeys[newSpace.id] = { role: 'creator', token: masterKey };
      localStorage.setItem('smartshare_keys', JSON.stringify(localKeys));
    } catch(e) {}

    // 2. Save Space to DB
    setSpacesBase(prev => [newSpace, ...prev]);
    await setDoc(doc(db, 'spaces', newSpace.id), newSpace);

    // 3. Dispatch an event so AuthContext can sync it to the User Profile
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smartshare_new_key', { detail: { spaceId: newSpace.id, role: 'creator', token: masterKey } }));
    }
  };`;

c = c.replace(target, replacement);

fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Fixed addSpace again');

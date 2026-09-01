const fs = require('fs');
let c = fs.readFileSync('src/app/context/AuthContext.tsx', 'utf-8');

c = c.replace(
  /const unsubscribe = onAuthStateChanged\(auth, async \(firebaseUser\) => \{/,
  `// Sync Keyring
    const handleNewKey = async (e: Event) => {
      const { spaceId, role, token } = (e as CustomEvent).detail;
      if (!auth.currentUser) return;
      
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserProfile;
        const currentKeys = userData.spaceKeys || {};
        currentKeys[spaceId] = { role, token };
        await updateDoc(userRef, { spaceKeys: currentKeys });
        
        setUser(prev => prev ? { ...prev, spaceKeys: currentKeys } : prev);
      }
    };
    if (typeof window !== 'undefined') window.addEventListener('smartshare_new_key', handleNewKey);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {`
);

c = c.replace(
  /return \(\) => unsubscribe\(\);/,
  `return () => {
      unsubscribe();
      if (typeof window !== 'undefined') window.removeEventListener('smartshare_new_key', handleNewKey);
    };`
);

fs.writeFileSync('src/app/context/AuthContext.tsx', c);
console.log('Fixed AuthContext keychain');

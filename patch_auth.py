import re

with open('src/app/context/AuthContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(', signInAnonymously', '')
content = content.replace('if (!auth.currentUser || auth.currentUser.isAnonymous) return;', 'if (!auth.currentUser) return;')

# Find onAuthStateChanged
pattern = r'const unsubscribe = onAuthStateChanged\(auth, async \(firebaseUser\) => \{.*?(?=    return \(\) => \{)'
new_auth_state = '''const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setIsLoaded(true);
        return;
      }

      // We have a firebase user, check Firestore for their profile
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        let activeUser: UserProfile;
        
        if (userSnap.exists()) {
          activeUser = userSnap.data() as UserProfile;
          let needsUpdate = false;
          
          const shouldBeAdmin = activeUser.phone === '0500000000' || activeUser.email === 'yehuda.algawi@gmail.com';
          if (activeUser.isAdmin !== shouldBeAdmin && !activeUser.isAdmin) {
            activeUser.isAdmin = shouldBeAdmin;
            needsUpdate = true;
          }

          const bestName = firebaseUser.displayName || firebaseUser.providerData?.[0]?.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : null);
          const bestPhoto = firebaseUser.photoURL || firebaseUser.providerData?.[0]?.photoURL;
          const bestEmail = firebaseUser.email || firebaseUser.providerData?.[0]?.email;

          if ((activeUser.realName === 'אורח' || !activeUser.realName || activeUser.realName === 'משתמש אנונימי') && bestName) {
            activeUser.realName = bestName;
            activeUser.nickname = bestName.split(' ')[0];
            needsUpdate = true;
          }
          if (!activeUser.avatarUrl && bestPhoto) {
            activeUser.avatarUrl = bestPhoto;
            needsUpdate = true;
          }
          if (!activeUser.email && bestEmail) {
            activeUser.email = bestEmail;
            needsUpdate = true;
          }

          if (needsUpdate) {
            await updateDoc(userRef, { 
              isAdmin: activeUser.isAdmin ?? false,
              realName: activeUser.realName || 'אורח',
              nickname: activeUser.nickname || '',
              avatarUrl: activeUser.avatarUrl || null,
              email: activeUser.email || ''
            });
          }
        } else {
          // Create new user profile in Firestore
          const bestName = firebaseUser.displayName || firebaseUser.providerData?.[0]?.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : null);
          const bestPhoto = firebaseUser.photoURL || firebaseUser.providerData?.[0]?.photoURL;
          const bestEmail = firebaseUser.email || firebaseUser.providerData?.[0]?.email;
          
          activeUser = {
            id: firebaseUser.uid,
            realName: bestName || 'אורח',
            phone: firebaseUser.phoneNumber || '',
            email: bestEmail || '',
            nickname: (bestName ? bestName.split(' ')[0] : ''),
            avatarUrl: bestPhoto || null,
            status: 'hidden',
            contacts: [],
            isAdmin: (bestEmail === 'yehuda.algawi@gmail.com' || firebaseUser.phoneNumber === '0500000000'),
            createdAt: new Date().toISOString(),
          };
          await setDoc(userRef, activeUser);
        }

        if (typeof window !== 'undefined') {
          try {
            const parsed = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
            const localKeys = parsed || {};
            const currentKeys = activeUser.spaceKeys || {};
            let keysUpdated = false;
            
            Object.keys(localKeys).forEach(spaceId => {
              if (!currentKeys[spaceId]) {
                currentKeys[spaceId] = localKeys[spaceId];
                keysUpdated = true;
              }
            });
            
            if (keysUpdated) {
              activeUser.spaceKeys = currentKeys;
              await updateDoc(userRef, { spaceKeys: currentKeys });
            }
          } catch(e) {}
        }

        if (!activeUser.isBlocked) {
          setUser({ ...activeUser, id: firebaseUser.uid } as any);
        }
        setIsLoaded(true);
      } catch (error) {
        console.error("Auth context error:", error);
        setIsLoaded(true);
      }
    });\n\n'''
content = re.sub(pattern, new_auth_state, content, flags=re.DOTALL)

sync_pattern = r'const syncProviderData = async \(firebaseUser: any.*?catch \(err\) \{\n        console.error\("Failed to sync provider data", err\);\n      \}\n    \};\n'
new_sync = '''const syncProviderData = async (firebaseUser: any, forcedName?: string) => {
      if (!firebaseUser) return;
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          let activeUser = userSnap.data() as UserProfile;
          let needsUpdate = false;
          
          const bestName = forcedName || firebaseUser.displayName || firebaseUser.providerData?.[0]?.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : null);
          const bestPhoto = firebaseUser.photoURL || firebaseUser.providerData?.[0]?.photoURL;
          const bestEmail = firebaseUser.email || firebaseUser.providerData?.[0]?.email;

          if ((activeUser.realName === 'אורח' || !activeUser.realName) && bestName) {
            activeUser.realName = bestName;
            activeUser.nickname = bestName.split(' ')[0];
            needsUpdate = true;
          }
          if (!activeUser.avatarUrl && bestPhoto) {
            activeUser.avatarUrl = bestPhoto;
            needsUpdate = true;
          }
          if (!activeUser.email && bestEmail) {
            activeUser.email = bestEmail;
            needsUpdate = true;
          }

          if (needsUpdate) {
            await updateDoc(userRef, { 
              realName: activeUser.realName,
              nickname: activeUser.nickname,
              avatarUrl: activeUser.avatarUrl,
              email: activeUser.email
            });
          }
          setUser(prev => prev ? { ...prev, ...activeUser, id: firebaseUser.uid } as any : { ...activeUser, id: firebaseUser.uid } as any);
        }
      } catch (err) {
        console.error("Failed to sync provider data", err);
      }
    };
'''
content = re.sub(sync_pattern, new_sync, content, flags=re.DOTALL)

with open('src/app/context/AuthContext.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

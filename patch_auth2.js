const fs = require('fs');
const file = 'src/app/context/AuthContext.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(', signInAnonymously', '');
content = content.replace('if (!auth.currentUser || auth.currentUser.isAnonymous) return;', 'if (!auth.currentUser) return;');

// Regex replace onAuthStateChanged
const authStateRegex = /const unsubscribe = onAuthStateChanged\(auth, async \(firebaseUser\) => \{.*?(?=      return \(\) => \{)/s;
const newAuthState = 'const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {\\n' +
'      if (!firebaseUser) {\\n' +
'        setUser(null);\\n' +
'        setIsLoaded(true);\\n' +
'        return;\\n' +
'      }\\n' +
'\\n' +
'      // We have a firebase user, check Firestore for their profile\\n' +
'      try {\\n' +
'        const userRef = doc(db, \\'users\\', firebaseUser.uid);\\n' +
'        const userSnap = await getDoc(userRef);\\n' +
'        \\n' +
'        let activeUser: UserProfile;\\n' +
'        \\n' +
'        if (userSnap.exists()) {\\n' +
'          activeUser = userSnap.data() as UserProfile;\\n' +
'          let needsUpdate = false;\\n' +
'          \\n' +
'          const shouldBeAdmin = activeUser.phone === \\'0500000000\\' || activeUser.email === \\'yehuda.algawi@gmail.com\\';\\n' +
'          if (activeUser.isAdmin !== shouldBeAdmin && !activeUser.isAdmin) {\\n' +
'            activeUser.isAdmin = shouldBeAdmin;\\n' +
'            needsUpdate = true;\\n' +
'          }\\n' +
'\\n' +
'          const bestName = firebaseUser.displayName || firebaseUser.providerData?.[0]?.displayName || (firebaseUser.email ? firebaseUser.email.split(\\'@\\')[0] : null);\\n' +
'          const bestPhoto = firebaseUser.photoURL || firebaseUser.providerData?.[0]?.photoURL;\\n' +
'          const bestEmail = firebaseUser.email || firebaseUser.providerData?.[0]?.email;\\n' +
'\\n' +
'          if ((activeUser.realName === \\'אורח\\' || activeUser.realName === \\'אורח ללא הזדהות\\' || !activeUser.realName) && bestName) {\\n' +
'            activeUser.realName = bestName;\\n' +
'            activeUser.nickname = bestName.split(\\' \\')[0];\\n' +
'            needsUpdate = true;\\n' +
'          }\\n' +
'          if (!activeUser.avatarUrl && bestPhoto) {\\n' +
'            activeUser.avatarUrl = bestPhoto;\\n' +
'            needsUpdate = true;\\n' +
'          }\\n' +
'          if (!activeUser.email && bestEmail) {\\n' +
'            activeUser.email = bestEmail;\\n' +
'            needsUpdate = true;\\n' +
'          }\\n' +
'\\n' +
'          if (needsUpdate) {\\n' +
'            await updateDoc(userRef, { \\n' +
'              isAdmin: activeUser.isAdmin ?? false,\\n' +
'              realName: activeUser.realName || \\'אורח\\',\\n' +
'              nickname: activeUser.nickname || \\'\\',\\n' +
'              avatarUrl: activeUser.avatarUrl || null,\\n' +
'              email: activeUser.email || \\'\\'\\n' +
'            });\\n' +
'          }\\n' +
'        } else {\\n' +
'          // Create new user profile in Firestore\\n' +
'          const bestName = firebaseUser.displayName || firebaseUser.providerData?.[0]?.displayName || (firebaseUser.email ? firebaseUser.email.split(\\'@\\')[0] : null);\\n' +
'          const bestPhoto = firebaseUser.photoURL || firebaseUser.providerData?.[0]?.photoURL;\\n' +
'          const bestEmail = firebaseUser.email || firebaseUser.providerData?.[0]?.email;\\n' +
'          \\n' +
'          activeUser = {\\n' +
'            id: firebaseUser.uid,\\n' +
'            realName: bestName || \\'אורח\\',\\n' +
'            phone: firebaseUser.phoneNumber || \\'\\',\\n' +
'            email: bestEmail || \\'\\',\\n' +
'            nickname: (bestName ? bestName.split(\\' \\')[0] : \\'\\'),\\n' +
'            avatarUrl: bestPhoto || null,\\n' +
'            status: \\'hidden\\',\\n' +
'            contacts: [],\\n' +
'            isAdmin: (bestEmail === \\'yehuda.algawi@gmail.com\\' || firebaseUser.phoneNumber === \\'0500000000\\'),\\n' +
'            createdAt: new Date().toISOString(),\\n' +
'          };\\n' +
'          await setDoc(userRef, activeUser);\\n' +
'        }\\n' +
'\\n' +
'        if (typeof window !== \\'undefined\\') {\\n' +
'          try {\\n' +
'            const parsed = JSON.parse(localStorage.getItem(\\'smartshare_keys\\') || \\'{}\\');\\n' +
'            const localKeys = parsed || {};\\n' +
'            const currentKeys = activeUser.spaceKeys || {};\\n' +
'            let keysUpdated = false;\\n' +
'            \\n' +
'            Object.keys(localKeys).forEach(spaceId => {\\n' +
'              if (!currentKeys[spaceId]) {\\n' +
'                currentKeys[spaceId] = localKeys[spaceId];\\n' +
'                keysUpdated = true;\\n' +
'              }\\n' +
'            });\\n' +
'            \\n' +
'            if (keysUpdated) {\\n' +
'              activeUser.spaceKeys = currentKeys;\\n' +
'              await updateDoc(userRef, { spaceKeys: currentKeys });\\n' +
'            }\\n' +
'          } catch(e) {}\\n' +
'        }\\n' +
'\\n' +
'        if (!activeUser.isBlocked) {\\n' +
'          setUser({ ...activeUser, id: firebaseUser.uid } as any);\\n' +
'        }\\n' +
'        setIsLoaded(true);\\n' +
'      } catch (error) {\\n' +
'        console.error("Auth context error:", error);\\n' +
'        setIsLoaded(true);\\n' +
'      }\\n' +
'    });\\n';
content = content.replace(authStateRegex, newAuthState);

const syncRegex = /const syncProviderData = async \(firebaseUser: any, forcedName\?: string\) => \{.*?catch \(err\) \{\n        console.error\("Failed to sync provider data", err\);\n      \}\n    \};\n/s;
const newSync = 'const syncProviderData = async (firebaseUser: any, forcedName?: string) => {\\n' +
'      if (!firebaseUser) return;\\n' +
'      try {\\n' +
'        const userRef = doc(db, \\'users\\', firebaseUser.uid);\\n' +
'        const userSnap = await getDoc(userRef);\\n' +
'        if (userSnap.exists()) {\\n' +
'          let activeUser = userSnap.data() as UserProfile;\\n' +
'          let needsUpdate = false;\\n' +
'          \\n' +
'          const bestName = forcedName || firebaseUser.displayName || firebaseUser.providerData?.[0]?.displayName || (firebaseUser.email ? firebaseUser.email.split(\\'@\\')[0] : null);\\n' +
'          const bestPhoto = firebaseUser.photoURL || firebaseUser.providerData?.[0]?.photoURL;\\n' +
'          const bestEmail = firebaseUser.email || firebaseUser.providerData?.[0]?.email;\\n' +
'\\n' +
'          if ((activeUser.realName === \\'אורח\\' || !activeUser.realName) && bestName) {\\n' +
'            activeUser.realName = bestName;\\n' +
'            activeUser.nickname = bestName.split(\\' \\')[0];\\n' +
'            needsUpdate = true;\\n' +
'          }\\n' +
'          if (!activeUser.avatarUrl && bestPhoto) {\\n' +
'            activeUser.avatarUrl = bestPhoto;\\n' +
'            needsUpdate = true;\\n' +
'          }\\n' +
'          if (!activeUser.email && bestEmail) {\\n' +
'            activeUser.email = bestEmail;\\n' +
'            needsUpdate = true;\\n' +
'          }\\n' +
'\\n' +
'          if (needsUpdate) {\\n' +
'            await updateDoc(userRef, { \\n' +
'              realName: activeUser.realName,\\n' +
'              nickname: activeUser.nickname,\\n' +
'              avatarUrl: activeUser.avatarUrl,\\n' +
'              email: activeUser.email\\n' +
'            });\\n' +
'          }\\n' +
'          setUser(prev => prev ? { ...prev, ...activeUser, id: firebaseUser.uid } as any : { ...activeUser, id: firebaseUser.uid } as any);\\n' +
'        }\\n' +
'      } catch (err) {\\n' +
'        console.error("Failed to sync provider data", err);\\n' +
'      }\\n' +
'    };\\n';
content = content.replace(syncRegex, newSync);

fs.writeFileSync(file, content, 'utf8');

const fs = require('fs');
const file = 'src/app/context/AuthContext.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add deleteUser to imports if not there
if (!content.includes('deleteUser } from \'firebase/auth\'')) {
  content = content.replace('updateProfile as updateFirebaseProfile, linkWithCredential } from \'firebase/auth\';', 'updateProfile as updateFirebaseProfile, linkWithCredential, deleteUser } from \'firebase/auth\';');
}

// 2. Add deleteMyAccount to Context Types
if (!content.includes('deleteMyAccount: () => Promise<void>;')) {
  content = content.replace('deleteUserDoc: (userId: string) => void;', 'deleteUserDoc: (userId: string) => void;\n  deleteMyAccount: () => Promise<void>;');
}

// 3. Add to Default Context
if (!content.includes('deleteMyAccount: async () => {},')) {
  content = content.replace('deleteUserDoc: () => {},', 'deleteUserDoc: () => {},\n    deleteMyAccount: async () => {},');
}

// 4. Add the function implementation
const deleteMyAccountFunc = `  const deleteMyAccount = async () => {
    if (!auth.currentUser || !user) return;
    try {
      await deleteDoc(doc(db, 'users', user.id));
      await deleteUser(auth.currentUser);
      setUser(null);
    } catch (e) {
      console.error('Failed to delete my account', e);
      throw e;
    }
  };

  const deleteUserDoc`;

if (!content.includes('const deleteMyAccount = async')) {
  content = content.replace('const deleteUserDoc', deleteMyAccountFunc);
}

// 5. Add to Provider value
if (!content.includes('deleteMyAccount,')) {
  content = content.replace('deleteUserDoc, isLoaded', 'deleteUserDoc, deleteMyAccount, isLoaded');
}

// 6. Fix loginWithGoogle for popup blocked
const googlePopupFallback = `      } catch (e: any) {
        console.error('Google login failed', e);
        if (e.code === 'auth/popup-blocked') {
          if (window.confirm('הדפדפן חסם את החלון הקופץ. האם להמשיך להתחברות באותו מסך (Redirect)?')) {
             await signInWithRedirect(auth, googleProvider);
          }
        } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {`;
        
if (!content.includes('signInWithRedirect(auth, googleProvider)')) {
  content = content.replace(`      } catch (e: any) {
        console.error('Google login failed', e);
        if (e.code === 'auth/popup-blocked') {
          alert('⚠ הדפדפן שלך חוסם פופאפים.\\n\\nכדי להתחבר אנא פעל כך:\\n1. פתח את האתר בדפדפן כרום/ספארי נפרד (ולא בתוך אפליקציה)\\n2. היכנס להגדרות -> חלונות קופצים (Pop-ups) ואשר את האתר\\n3. נסה שוב');
        } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {`, googlePopupFallback);
}

fs.writeFileSync(file, content, 'utf8');
console.log("AuthContext updated");

const fs = require('fs');
let content = fs.readFileSync('src/app/context/AuthContext.tsx', 'utf8');

const implementation = 
  const linkPhoneNumberMock = async (phone: string) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { phone });
      setUser(prev => prev ? { ...prev, phone } : prev);
      
      // Admin CRM array optimistic update
      setAllUsers(prev => prev.map(u => u.id === user.id ? { ...u, phone } : u));
    } catch (e) {
      console.error('Error linking phone:', e);
      throw e;
    }
  };

  const findUserByPhone = async (phone: string): Promise<UserProfile | null> => {
    try {
      const q = collection(db, 'users');
      const snapshot = await getDocs(q);
      let foundUser = null;
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as UserProfile;
        // Basic match, ignoring spaces/dashes
        const cleanDbPhone = (data.phone || '').replace(/\\D/g, '');
        const cleanQueryPhone = phone.replace(/\\D/g, '');
        if (cleanDbPhone && cleanDbPhone === cleanQueryPhone) {
          foundUser = { ...data, id: docSnap.id };
        }
      });
      return foundUser;
    } catch (e) {
      console.error('Error finding user by phone:', e);
      return null;
    }
  };
;

const target = 'const deleteUserDoc = async (userId: string) => {';
content = content.replace(target, implementation + '\n\n  ' + target);

fs.writeFileSync('src/app/context/AuthContext.tsx', content);
console.log('Added implementations');

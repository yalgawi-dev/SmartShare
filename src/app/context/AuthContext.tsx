'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, googleProvider } from '@/lib/firebase';
import { signInAnonymously, onAuthStateChanged, signInWithPopup, linkWithPopup, FacebookAuthProvider, OAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, EmailAuthProvider, updateProfile as updateFirebaseProfile, linkWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';

export interface UserContact {
  id: string;
  name: string;
  avatarUrl?: string;
  phone?: string;
  addedAt: string;
}

export interface UserProfile {
  id: string;
  realName: string;
  nickname?: string;
  avatarUrl?: string;
  phone?: string;
  email?: string;
  status?: 'single' | 'married' | 'relationship' | 'complicated' | 'hidden' | 'divorced' | 'widowed' | 'other';
  customStatus?: string;
  birthDate?: string;
  zodiacSign?: string;
  gender?: 'male' | 'female' | 'other';
  contacts: UserContact[];
  isAdmin: boolean;
  isBlocked?: boolean;
  createdAt: string;
  hideRealName?: boolean;
  spaceKeys?: Record<string, { role: "creator" | "partner", token: string }>;
}

interface AuthContextType {
  user: UserProfile | null;
  allUsers: UserProfile[]; // For Admin CRM simulation
  login: (phone: string, realName: string) => void;
  loginWithGoogle: () => Promise<any>;
  loginWithFacebook: () => Promise<any>;
  loginWithEmail: (email: string, pass: string) => Promise<any>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<any>;
  resetPassword: (email: string) => Promise<void>;
  loginWithApple: () => Promise<any>;
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  addContact: (contact: Omit<UserContact, 'addedAt'>) => void;
  blockUser: (userId: string, block: boolean) => void; // Admin action
  toggleAdmin: (userId: string, makeAdmin: boolean) => void;
  deleteUserDoc: (userId: string) => void; // Admin action
  isLoaded: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  allUsers: [],
  login: () => {},
  loginWithGoogle: async () => {},
  loginWithFacebook: async () => {},
  loginWithEmail: async () => {},
  registerWithEmail: async () => {},
  resetPassword: async () => {},
  loginWithApple: async () => {},
  logout: () => {},
  updateProfile: () => {},
  addContact: () => {},
  blockUser: () => {},
  toggleAdmin: () => {},
  deleteUserDoc: () => {},
  isLoaded: false,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load all users for the CRM (admin view) - simplified for prototype
  const fetchAllUsers = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      setAllUsers(usersSnap.docs.map(d => d.data() as UserProfile));
    } catch (e) {
      console.error("Failed to fetch CRM users", e);
    }
  };

  useEffect(() => {
    if (user?.isAdmin) {
      fetchAllUsers();
    }
  }, [user?.isAdmin]);

  useEffect(() => {
    // Sync local keys from localStorage to Firestore whenever they change
    const handleNewKey = async (e: Event) => {
      if (!auth.currentUser || auth.currentUser.isAnonymous) return;
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      
      const { spaceId, role, token } = detail;
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

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // Sign in anonymously if no user is found
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Firebase Anonymous Auth Error:", error);
        }
      } else {
        // We have a firebase user, check Firestore for their profile
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          
          let activeUser: UserProfile;
          
          if (userSnap.exists()) {
            activeUser = userSnap.data() as UserProfile;
            let needsUpdate = false;
            
            // Force Admin ONLY for specific emails or phone numbers
            const shouldBeAdmin = activeUser.phone === '0500000000' || activeUser.email === 'yehuda.algawi@gmail.com';
            if (activeUser.isAdmin !== shouldBeAdmin && !activeUser.isAdmin) {
              activeUser.isAdmin = shouldBeAdmin;
              needsUpdate = true;
            }

            // If they linked a provider (Google/Facebook) but their profile still says 'אורח', update it!
            if (!firebaseUser.isAnonymous) {
              const bestName = firebaseUser.displayName || firebaseUser.providerData?.[0]?.displayName;
              const bestPhoto = firebaseUser.photoURL || firebaseUser.providerData?.[0]?.photoURL;
              const bestEmail = firebaseUser.email || firebaseUser.providerData?.[0]?.email;

              if ((activeUser.realName === 'אורח' || activeUser.realName === 'אורח אנונימי' || !activeUser.realName) && bestName) {
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
            }

            if (needsUpdate) {
              await updateDoc(userRef, { 
                isAdmin: activeUser.isAdmin,
                realName: activeUser.realName,
                nickname: activeUser.nickname || '',
                avatarUrl: activeUser.avatarUrl || null,
                email: activeUser.email || ''
              });
            }
          } else {
            // Check if there is a local storage user we can migrate (from before the cloud refactor)
            const savedUsers = localStorage.getItem('smartshare_users');
            let legacyLocalUser: UserProfile | undefined;
            if (savedUsers) {
              try {
                const parsed = JSON.parse(savedUsers) as UserProfile[];
                legacyLocalUser = parsed[0];
              } catch (e) {}
            }
            
            // Create new user profile in Firestore
            const bestName = firebaseUser.displayName || firebaseUser.providerData?.[0]?.displayName;
            const bestPhoto = firebaseUser.photoURL || firebaseUser.providerData?.[0]?.photoURL;
            const bestEmail = firebaseUser.email || firebaseUser.providerData?.[0]?.email;
            
            activeUser = {
              id: firebaseUser.uid,
              realName: bestName || legacyLocalUser?.realName || 'אורח',
              phone: firebaseUser.phoneNumber || legacyLocalUser?.phone || '',
              email: bestEmail || legacyLocalUser?.email || '',
              nickname: legacyLocalUser?.nickname || (bestName ? bestName.split(' ')[0] : ''),
              avatarUrl: bestPhoto || undefined,
              status: legacyLocalUser?.status || 'hidden',
              contacts: legacyLocalUser?.contacts || [],
              isAdmin: (bestEmail === 'yehuda.algawi@gmail.com' || firebaseUser.phoneNumber === '0500000000'),
              createdAt: new Date().toISOString(),
            };
            await setDoc(userRef, activeUser);
          }

          // Fundamental Fix: Merge local cache keys into Firebase ONLY for authenticated Google accounts (never leak to anonymous guests)
          if (typeof window !== 'undefined' && !firebaseUser.isAnonymous) {
            try {
              const localKeys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
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
            } catch(e) {
              console.error('Failed to merge local keys', e);
            }
          }

          if (!activeUser.isBlocked) {
            setUser(activeUser);
          }
          setIsLoaded(true);
        } catch (error) {
          console.error("Auth context error:", error);
          setIsLoaded(true);
        }
      }
    });

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') window.removeEventListener('smartshare_new_key', handleNewKey);
    };
  }, []);

  const syncProviderData = async (firebaseUser: any, forcedName?: string) => {
    if (!firebaseUser || firebaseUser.isAnonymous) return;
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        let activeUser = userSnap.data() as UserProfile;
        let needsUpdate = false;
        
        const bestName = forcedName || firebaseUser.displayName || firebaseUser.providerData?.[0]?.displayName;
        const bestPhoto = firebaseUser.photoURL || firebaseUser.providerData?.[0]?.photoURL;
        const bestEmail = firebaseUser.email || firebaseUser.providerData?.[0]?.email;

        if ((activeUser.realName === 'אורח' || activeUser.realName === 'אורח אנונימי' || !activeUser.realName) && bestName) {
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
            nickname: activeUser.nickname || '',
            avatarUrl: activeUser.avatarUrl || null,
            email: activeUser.email || ''
          });
          setUser(prev => prev ? { ...prev, ...activeUser } : activeUser);
        }
      }
    } catch (err) {
      console.error("Failed to sync provider data", err);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    let result;
    if (auth.currentUser && auth.currentUser.isAnonymous) {
      const credential = EmailAuthProvider.credential(email, pass);
      try {
        result = await linkWithCredential(auth.currentUser, credential);
      } catch (linkError: any) {
        if (linkError.code === 'auth/credential-already-in-use' || linkError.code === 'auth/email-already-in-use') {
          result = await signInWithEmailAndPassword(auth, email, pass);
        } else {
          throw linkError;
        }
      }
    } else {
      result = await signInWithEmailAndPassword(auth, email, pass);
    }
    await syncProviderData(result.user);
    return result.user;
  };

  const registerWithEmail = async (email: string, pass: string, name: string) => {
    let result;
    if (auth.currentUser && auth.currentUser.isAnonymous) {
      const credential = EmailAuthProvider.credential(email, pass);
      try {
        result = await linkWithCredential(auth.currentUser, credential);
      } catch (linkError: any) {
        if (linkError.code === 'auth/credential-already-in-use' || linkError.code === 'auth/email-already-in-use') {
          throw new Error('האימייל הזה כבר קיים במערכת, אנא התחבר.');
        } else {
          throw linkError;
        }
      }
    } else {
      result = await createUserWithEmailAndPassword(auth, email, pass);
    }
    
    await updateFirebaseProfile(result.user, { displayName: name });
    await syncProviderData(result.user, name);
    return result.user;
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const loginWithGoogle = async () => {
    try {
      let result;
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        try {
          result = await linkWithPopup(auth.currentUser, googleProvider);
        } catch (linkError: any) {
          if (linkError.code === 'auth/credential-already-in-use') {
            result = await signInWithPopup(auth, googleProvider);
          } else {
            throw linkError;
          }
        }
      } else {
        result = await signInWithPopup(auth, googleProvider);
      }
      console.log('Google login success', result.user);
      await syncProviderData(result.user);
      return result.user;
    } catch (e: any) {
      console.error('Google login failed', e);
      if (e.code === 'auth/popup-blocked') {
        alert('שגיאה: חוסם החלונות הקופצים בדפדפן מופעל. אנא אפשר חלונות קופצים (Pop-ups) עבור אתר זה כדי להתחבר.');
      } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        alert('שגיאה בהתחברות: ' + (e.message || 'נסה שוב'));
      }
      throw e;
    }
  };

  const loginWithFacebook = async () => {
    try {
      const provider = new FacebookAuthProvider();
      provider.addScope('email');
      provider.addScope('public_profile');
      
      let result;
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        try {
          result = await linkWithPopup(auth.currentUser, provider);
        } catch (linkError: any) {
          if (linkError.code === 'auth/credential-already-in-use') {
            result = await signInWithPopup(auth, provider);
          } else {
            throw linkError;
          }
        }
      } else {
        result = await signInWithPopup(auth, provider);
      }
      console.log('Facebook login success', result.user);
      await syncProviderData(result.user);
      return result.user;
    } catch (e: any) {
      console.error('Facebook login failed', e);
      if (e.code === 'auth/popup-blocked') {
        alert('שגיאה: חוסם החלונות הקופצים בדפדפן מופעל. אנא אפשר חלונות קופצים (Pop-ups) עבור אתר זה כדי להתחבר.');
      } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        alert('שגיאה בהתחברות: ' + (e.message || 'נסה שוב'));
      }
      throw e;
    }
  };

  const loginWithApple = async () => {
    try {
      const provider = new OAuthProvider('apple.com');
      
      let result;
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        try {
          result = await linkWithPopup(auth.currentUser, provider);
        } catch (linkError: any) {
          if (linkError.code === 'auth/credential-already-in-use') {
            result = await signInWithPopup(auth, provider);
          } else {
            throw linkError;
          }
        }
      } else {
        result = await signInWithPopup(auth, provider);
      }
      console.log('Apple login success', result.user);
      await syncProviderData(result.user);
      return result.user;
    } catch (e: any) {
      console.error('Apple login failed', e);
      if (e.code === 'auth/operation-not-supported-in-this-environment' || e.code === 'auth/unauthorized-domain' || e.message?.includes('configuration')) {
         alert('Apple Sign-In דורש הגדרות מיוחדות מול Firebase. אנא הכנס מזהה Apple Developer Service ID.');
      } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        alert('שגיאה בהתחברות: ' + (e.message || 'נסה שוב'));
      }
      throw e;
    }
  };

  const login = async (phone: string, realName: string) => {
    if (!user) return;
    
    const updatedUser = { ...user, phone, realName, isAdmin: phone === '0500000000' };
    
    // Update local state immediately
    setUser(updatedUser);
    
    // Push to Firestore
    try {
      await updateDoc(doc(db, 'users', user.id), { phone, realName, isAdmin: updatedUser.isAdmin });
    } catch (e) {
      console.error("Failed to update user login details in Firestore", e);
    }
  };

  const logout = async () => {
    // Complete device isolation: wipe local keys and guest tokens upon logout
    if (typeof window !== 'undefined') {
      localStorage.removeItem('smartshare_keys');
      localStorage.removeItem('smartshare_guests');
    }
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    try {
      await updateDoc(doc(db, 'users', user.id), updates);
    } catch (e) {
      console.error("Failed to update profile", e);
    }
  };

  const addContact = async (contact: Omit<UserContact, 'addedAt'>) => {
    if (!user) return;
    const newContact: UserContact = { ...contact, addedAt: new Date().toISOString() };
    const updatedContacts = [...(user.contacts || []), newContact];
    setUser({ ...user, contacts: updatedContacts });
    try {
      await updateDoc(doc(db, 'users', user.id), { contacts: updatedContacts });
    } catch (e) {
      console.error("Failed to add contact", e);
    }
  };

  const blockUser = async (userId: string, block: boolean) => {
    if (!user?.isAdmin) return;
    try {
      await updateDoc(doc(db, 'users', userId), { isBlocked: block });
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, isBlocked: block } : u));
    } catch (e) {
      console.error("Failed to block user", e);
    }
  };

  const toggleAdmin = async (userId: string, makeAdmin: boolean) => {
    if (!user?.isAdmin) return;
    try {
      await updateDoc(doc(db, 'users', userId), { isAdmin: makeAdmin });
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, isAdmin: makeAdmin } : u));
    } catch (e) {
      console.error("Failed to toggle admin", e);
    }
  };

  const deleteUserDoc = async (userId: string) => {
    if (!user?.isAdmin) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      setAllUsers(prev => prev.filter(u => u.id !== userId));
    } catch (e) {
      console.error("Failed to delete user", e);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, allUsers, login, 
      loginWithGoogle, loginWithFacebook, loginWithApple, 
      loginWithEmail, registerWithEmail, resetPassword,
      logout, updateProfile, addContact, blockUser, toggleAdmin, deleteUserDoc, isLoaded 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

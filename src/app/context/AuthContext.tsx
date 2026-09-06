'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';

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
  loginWithApple: () => Promise<any>;
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  addContact: (contact: Omit<UserContact, 'addedAt'>) => void;
  blockUser: (userId: string, block: boolean) => void; // Admin action
  toggleAdmin: (userId: string, makeAdmin: boolean) => void;
  isLoaded: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  allUsers: [],
  login: () => {},
  loginWithGoogle: async () => {},
  loginWithFacebook: async () => {},
  loginWithApple: async () => {},
  logout: () => {},
  updateProfile: () => {},
  addContact: () => {},
  blockUser: () => {},
  toggleAdmin: () => {},
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
      const users = usersSnap.docs.map(d => d.data() as UserProfile);
      setAllUsers(users);
    } catch (e) {
      console.error("Failed to fetch all users", e);
    }
  };

  useEffect(() => {
      import('firebase/auth').then(({ getRedirectResult }) => {
        getRedirectResult(auth).then((result) => {
          if (result && result.user) {
            console.log("Successfully logged in via redirect", result.user);
          }
        }).catch((e) => {
          console.error("Redirect login error:", e);
        });
      });

      // 1. Firebase Auth Listener
    // Sync Keyring
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
            
            // Force Admin for prototype or specific emails
            if (!activeUser.isAdmin) {
              activeUser.isAdmin = true;
              needsUpdate = true;
            }

            // If they linked a provider (Google/Facebook) but their profile still says 'אורח', update it!
            if (!firebaseUser.isAnonymous) {
              if ((activeUser.realName === 'אורח' || activeUser.realName === 'אורח אנונימי' || !activeUser.realName) && firebaseUser.displayName) {
                activeUser.realName = firebaseUser.displayName;
                activeUser.nickname = firebaseUser.displayName.split(' ')[0];
                needsUpdate = true;
              }
              if (!activeUser.avatarUrl && firebaseUser.photoURL) {
                activeUser.avatarUrl = firebaseUser.photoURL;
                needsUpdate = true;
              }
              if (!activeUser.email && firebaseUser.email) {
                activeUser.email = firebaseUser.email;
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
                // We just take the first local user as the migrated one since we don't have their local ID
                legacyLocalUser = parsed[0];
              } catch (e) {}
            }
            
            // Create new user profile in Firestore
            activeUser = {
              id: firebaseUser.uid,
              realName: firebaseUser.displayName || legacyLocalUser?.realName || 'אורח',
              phone: firebaseUser.phoneNumber || legacyLocalUser?.phone || '',
              email: firebaseUser.email || legacyLocalUser?.email || '',
              nickname: legacyLocalUser?.nickname || (firebaseUser.displayName ? firebaseUser.displayName.split(' ')[0] : ''),
              avatarUrl: firebaseUser.photoURL || undefined,
              status: legacyLocalUser?.status || 'hidden',
              contacts: legacyLocalUser?.contacts || [],
              isAdmin: true,
              createdAt: new Date().toISOString(),
            };
            await setDoc(userRef, activeUser);
          }

          // Fundamental Fix: Merge local cache keys into Firebase ONLY for authenticated Google accounts (never leak to anonymous guests)
          if (typeof window !== 'undefined' && firebaseUser.email) {
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
          
          // Also fetch all users for admin
          if (activeUser.isAdmin) {
             fetchAllUsers();
          }
        } catch (e) {
          console.error("Error fetching user from Firestore", e);
        }

        setIsLoaded(true);
      }
    });

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') window.removeEventListener('smartshare_new_key', handleNewKey);
    };
  }, []);

  const loginWithGoogle = async () => {
    try {
      const { signInWithPopup, linkWithPopup } = await import('firebase/auth');
      const { googleProvider } = await import('@/lib/firebase');
      
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
      return result.user;
    } catch (e: any) {
      console.error('Google login failed', e);
      // We don't alert here anymore so the caller can decide, or we can just alert and throw
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        alert('שגיאה בהתחברות: ' + (e.message || 'נסה שוב'));
      }
      throw e;
    }
  };

  const loginWithFacebook = async () => {
    try {
      const { signInWithPopup, linkWithPopup, FacebookAuthProvider } = await import('firebase/auth');
      const provider = new FacebookAuthProvider();
      
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
      return result.user;
    } catch (e: any) {
      console.error('Facebook login failed', e);
      if (e.code === 'auth/operation-not-supported-in-this-environment' || e.code === 'auth/unauthorized-domain' || e.message?.includes('configuration')) {
         alert('Facebook Login עדיין לא הוגדר במסוף Firebase. אנא עקוב אחר ההוראות להגדרת Facebook Developer App.');
      } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        alert('שגיאה בהתחברות: ' + (e.message || 'נסה שוב'));
      }
      throw e;
    }
  };

  const loginWithApple = async () => {
    try {
      const { signInWithPopup, linkWithPopup, OAuthProvider } = await import('firebase/auth');
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
      return result.user;
    } catch (e: any) {
      console.error('Apple login failed', e);
      if (e.code === 'auth/operation-not-supported-in-this-environment' || e.code === 'auth/unauthorized-domain' || e.message?.includes('configuration')) {
         alert('Apple Sign-In עדיין לא הוגדר במסוף Firebase. אנא הגדר Apple Developer Service ID.');
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
      try {
        localStorage.removeItem('smartshare_keys');
        localStorage.removeItem('smartshare_guest_tokens');
        localStorage.removeItem('smartshare_users');
        localStorage.removeItem('smartshare_session_id');
      } catch (e) {}
    }
    await auth.signOut();
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    setAllUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
    
    try {
      await updateDoc(doc(db, 'users', user.id), updates);
    } catch (e) {
      console.error("Failed to update profile in Firestore", e);
    }
  };

  const addContact = async (contact: Omit<UserContact, 'addedAt'>) => {
    if (!user) return;
    const newContact: UserContact = { ...contact, addedAt: new Date().toISOString() };
    if (user.contacts.some(c => c.id === contact.id)) return;

    const updatedContacts = [...user.contacts, newContact];
    setUser({ ...user, contacts: updatedContacts });
    
    try {
      await updateDoc(doc(db, 'users', user.id), { contacts: updatedContacts });
    } catch (e) {
      console.error("Failed to add contact in Firestore", e);
    }
  };

    const toggleAdmin = async (userId: string, makeAdmin: boolean) => {
    if (!user?.isAdmin) return;
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, isAdmin: makeAdmin } : u));
    try {
      await updateDoc(doc(db, "users", userId), { isAdmin: makeAdmin });
    } catch (e) {
      console.error("Failed to toggle admin in Firestore", e);
    }
  };

  const blockUser = async (userId: string, block: boolean) => {
    if (!user?.isAdmin) return;
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, isBlocked: block } : u));
    
    try {
      await updateDoc(doc(db, 'users', userId), { isBlocked: block });
    } catch (e) {
      console.error("Failed to block user in Firestore", e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, allUsers, login, loginWithGoogle, loginWithFacebook, loginWithApple, logout, updateProfile, addContact, blockUser, toggleAdmin, isLoaded }}>
      {children}
    </AuthContext.Provider>
  );
}

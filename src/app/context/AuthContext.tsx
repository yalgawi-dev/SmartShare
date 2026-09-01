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
  loginWithGoogle: () => Promise<void>;
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
            // Force Admin for prototype or specific emails
            if (!activeUser.isAdmin) {
              activeUser.isAdmin = true;
              await updateDoc(userRef, { isAdmin: true });
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
        } catch (linkError) {
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
    } catch (e) {
      console.error('Google login failed', e);
      alert('שגיאת התחברות (' + (e.code || 'כללי') + '):\n' + (e.message || 'לא ידוע'));
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

  const logout = () => {
    // Logout means they become a new anonymous user next time
    auth.signOut();
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
    <AuthContext.Provider value={{ user, allUsers, login, loginWithGoogle, logout, updateProfile, addContact, blockUser, toggleAdmin, isLoaded }}>
      {children}
    </AuthContext.Provider>
  );
}

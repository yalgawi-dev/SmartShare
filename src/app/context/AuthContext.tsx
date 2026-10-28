'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, googleProvider } from '@/lib/firebase';
import { setupForegroundFCM, requestNotificationPermission } from '@/utils/notifications';
import { signInWithPhoneNumber,  GoogleAuthProvider  } from 'firebase/auth';
import { signInWithRedirect, linkWithRedirect, getRedirectResult, onAuthStateChanged, signInWithPopup, linkWithPopup, FacebookAuthProvider, OAuthProvider, signOut, signInWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, EmailAuthProvider, updateProfile as updateFirebaseProfile, linkWithCredential, deleteUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc, onSnapshot } from 'firebase/firestore';

export interface UserContact {
  id: string;
  name: string;
  avatarUrl?: string;
  phone?: string;
  dismissedAlerts?: string[];
  fcmTokens?: string[];
  addedAt: string;
}

export interface UserProfile {
  fcmTokens?: string[];
  id: string;
  realName: string;
  nickname?: string;
  avatarUrl?: string;
  phone?: string;
  phoneVerified?: boolean;
  dismissedAlerts?: string[];
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
  pwaInstalled?: boolean;
  pwaLastSeenAt?: string;
  lastActiveAt?: string;
  lastActiveMode?: 'app' | 'browser';
  ocrCount?: number;
  ocrQuota?: number; // Maximum allocated OCR scans (default: 50, undefined = 50)
  storageBytesUsed?: number;
  storageQuotaMB?: number; // Maximum allocated Cloud Storage in MB (default: 500, undefined = 500)
  quotaMode?: 'storage' | 'pages'; // Mode of quota: by storage volume (KB/MB/GB) or by document pages count
  pagesQuota?: number; // Maximum allowed document pages (e.g. 50, 100, 500 pages)
  isQuotaActive?: boolean; // If false/undefined (when no limit enforced), user is Unlimited!
  hasCustomQuota?: boolean; // True if this user has VIP/custom limit override protected from global bulk overwrites
  storageConfig?: {
    defaultTarget: 'cloud' | 'local' | 'gdrive';
    spaceOverrides?: Record<string, 'cloud' | 'local' | 'gdrive'>;
  };
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
  updateUserByAdmin: (userId: string, updates: Partial<UserProfile>) => Promise<void>;
  updateAllUsersQuotasByAdmin: (updates: { 
    isQuotaActive: boolean; 
    storageQuotaMB?: number; 
    ocrQuota?: number; 
    quotaMode?: 'storage' | 'pages'; 
    pagesQuota?: number; 
    overrideCustom?: boolean; 
  }) => Promise<void>;
  deleteUserDoc: (userId: string) => void;
  deleteMyAccount: () => Promise<void>; // Admin action
  isLoaded: boolean;
  loginWithPhone: (phone: string, appVerifier: any) => Promise<any>;
    linkPhoneNumberMock: (phone: string) => Promise<void>;
  findUserByPhone: (phone: string) => Promise<UserProfile | null>;
  findUserById: (id: string) => Promise<UserProfile | null>;
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
  updateUserByAdmin: async () => {},
  updateAllUsersQuotasByAdmin: async () => {},
  deleteUserDoc: () => {},
    deleteMyAccount: async () => {},
  isLoaded: false,
  loginWithPhone: async () => {}, 
    linkPhoneNumberMock: async () => {},
  findUserByPhone: async () => null,
  findUserById: async () => null,
});

// Super Admin Verification Helper (Central Source of Truth)
export const checkIsSuperAdmin = (email?: string | null, phone?: string | null): boolean => {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPhone = (phone || '').replace(/\D/g, '');

  const adminEmails = [
    'yalgawi@gmail.com',
    'yehuda.algawi@gmail.com'
  ];
  
  const adminPhones = [
    '0509666008',
    '509666008',
    '972509666008',
    '0500000000',
    '500000000',
    '972500000000'
  ];

  return adminEmails.includes(cleanEmail) || adminPhones.includes(cleanPhone);
};

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load all users for the CRM (admin view) - now in REAL-TIME
  useEffect(() => {
    if (user?.isAdmin) {
      const unsubscribeUsers = onSnapshot(collection(db, 'users'), (usersSnap) => {
        setAllUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() }) as UserProfile));
      }, (e) => {
        console.error("Failed to fetch CRM users real-time", e);
      });
      return () => unsubscribeUsers();
    }
  }, [user?.isAdmin]);

  useEffect(() => {
    // Sync local keys from localStorage to Firestore whenever they change
    const handleNewKey = async (e: Event) => {
      if (!auth.currentUser) return;
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

    setupForegroundFCM();
    getRedirectResult(auth).then(res => { if (res && res.user) { console.log('Redirect result:', res.user); syncProviderData(res.user); } }).catch(err => console.error('Redirect Error:', err));

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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
          
          const bestName = firebaseUser.displayName || firebaseUser.providerData?.[0]?.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : null);
          const bestPhoto = firebaseUser.photoURL || firebaseUser.providerData?.[0]?.photoURL;
          const bestEmail = firebaseUser.email || firebaseUser.providerData?.[0]?.email || activeUser.email;
          const userPhone = firebaseUser.phoneNumber || activeUser.phone;

          const isOwnerAdmin = checkIsSuperAdmin(bestEmail, userPhone) || checkIsSuperAdmin(firebaseUser.email, firebaseUser.phoneNumber);
          if (isOwnerAdmin && !activeUser.isAdmin) {
            activeUser.isAdmin = true;
            needsUpdate = true;
          }

          if ((activeUser.realName === 'אורח' || activeUser.realName === 'אורח ללא הזדהות' || !activeUser.realName) && bestName) {
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
              realName: activeUser.realName || '',
              nickname: activeUser.nickname || '',
              avatarUrl: activeUser.avatarUrl || null,
              email: activeUser.email || ''
            });
          }
        } else {
          // Check global policy settings if configured by admin for newly registering users
          let initialQuotaConfig: any = {
            isQuotaActive: false, // Default: Unlimited unless admin activated global quota!
            storageQuotaMB: 500,
            pagesQuota: 100,
            quotaMode: 'storage',
            ocrQuota: 50,
            hasCustomQuota: false
          };

          try {
            const systemSettingsSnap = await getDoc(doc(db, 'system_settings', 'global_quotas'));
            if (systemSettingsSnap.exists()) {
              const sysData = systemSettingsSnap.data();
              initialQuotaConfig = {
                isQuotaActive: sysData.isQuotaActive ?? false,
                storageQuotaMB: sysData.storageQuotaMB ?? 500,
                pagesQuota: sysData.pagesQuota ?? 100,
                quotaMode: sysData.quotaMode ?? 'storage',
                ocrQuota: sysData.ocrQuota ?? 50,
                hasCustomQuota: false
              };
            }
          } catch (sysErr) {
            console.warn("Could not load global_quotas system settings, using safe defaults", sysErr);
          }
          
          const bestName = firebaseUser.displayName || firebaseUser.providerData?.[0]?.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : null);
          const bestPhoto = firebaseUser.photoURL || firebaseUser.providerData?.[0]?.photoURL;
          const bestEmail = firebaseUser.email || firebaseUser.providerData?.[0]?.email;
          const isAdminUser = checkIsSuperAdmin(bestEmail, firebaseUser.phoneNumber);

          activeUser = {
            id: firebaseUser.uid,
            realName: bestName || '',
            phone: firebaseUser.phoneNumber || '',
            email: bestEmail || '',
            nickname: (bestName ? bestName.split(' ')[0] : ''),
            avatarUrl: bestPhoto || null,
            status: 'hidden',
            contacts: [],
            isAdmin: isAdminUser,
            createdAt: new Date().toISOString(),
            ...initialQuotaConfig
          };
          await setDoc(userRef, activeUser);
        }

        if (!activeUser.isBlocked) {
          setUser({ ...activeUser, id: firebaseUser.uid } as any);
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            requestNotificationPermission(firebaseUser.uid).catch(console.error);
          }
          // Update presence immediately on login
          try {
            const isPwa = typeof window !== 'undefined' && (
              window.matchMedia('(display-mode: standalone)').matches ||
              (window.navigator as any).standalone === true
            );
            const presenceUpdates: any = { 
              lastActiveAt: new Date().toISOString(),
              lastActiveMode: isPwa ? 'app' : 'browser'
            };
            if (isPwa) {
              presenceUpdates.pwaInstalled = true;
              presenceUpdates.pwaLastSeenAt = new Date().toISOString();
            }
            await updateDoc(doc(db, 'users', firebaseUser.uid), presenceUpdates);
          } catch(e) {}
        }
        setIsLoaded(true);
      } catch (error) {
        console.error("Auth context error:", error);
        setIsLoaded(true);
      }
    });
    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') window.removeEventListener('smartshare_new_key', handleNewKey);
    };
  }, []);

  const syncProviderData = async (firebaseUser: any, forcedName?: string) => {
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

        const isOwnerAdmin = checkIsSuperAdmin(bestEmail, firebaseUser.phoneNumber || activeUser.phone);
        if (isOwnerAdmin && !activeUser.isAdmin) {
          activeUser.isAdmin = true;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await updateDoc(userRef, { 
            realName: activeUser.realName,
            nickname: activeUser.nickname,
            avatarUrl: activeUser.avatarUrl,
            email: activeUser.email,
            ...(isOwnerAdmin ? { isAdmin: true } : {})
          });
        }
        setUser(prev => prev ? { ...prev, ...activeUser, id: firebaseUser.uid } as any : { ...activeUser, id: firebaseUser.uid } as any);
      }
    } catch (err) {
      console.error("Failed to sync provider data", err);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    // LOGIN should strictly authenticate against an existing account.
    // It should NEVER use linkWithCredential with a new email/password, as that creates an account.
    const result = await signInWithEmailAndPassword(auth, email, pass);
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
      // Always use popup - signInWithRedirect is broken in modern browsers
      // due to storage partitioning (Chrome 115+, Samsung Internet, etc.)
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
    
    const updatedUser = { 
      ...user, 
      phone, 
      realName, 
      isAdmin: user.isAdmin || checkIsSuperAdmin(user.email, phone) 
    };
    
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
        localStorage.removeItem('smartshare_guests');
      } catch(e) {}
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

  const updateUserByAdmin = async (userId: string, updates: Partial<UserProfile>) => {
    if (!user?.isAdmin) return;
    try {
      await updateDoc(doc(db, 'users', userId), updates);
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
      if (user.id === userId) {
        setUser(prev => prev ? { ...prev, ...updates } : prev);
      }
    } catch (e) {
      console.error("Failed to update user by admin", e);
      throw e;
    }
  };

  const updateAllUsersQuotasByAdmin = async (updates: { 
    isQuotaActive: boolean; 
    storageQuotaMB?: number; 
    ocrQuota?: number; 
    quotaMode?: 'storage' | 'pages'; 
    pagesQuota?: number; 
    overrideCustom?: boolean; 
  }) => {
    if (!user?.isAdmin) return;
    try {
      const { overrideCustom = false, ...quotaFields } = updates;

      // 1. Persist to system_settings/global_quotas so all future users inherit it automatically!
      await setDoc(doc(db, 'system_settings', 'global_quotas'), {
        ...quotaFields,
        updatedAt: new Date().toISOString(),
        updatedBy: user.id
      }, { merge: true });

      // 2. Intelligent Benefiting Update for all users:
      // - Standard users: receive the exact global policy.
      // - VIP / Custom users:
      //     * If global is Unlimited (isQuotaActive === false) -> VIP becomes Unlimited too (benefits them!).
      //     * If global is active: VIP receives whichever is better (Math.max) for storage, pages, and OCR!
      //     * Their custom status (hasCustomQuota: true) is strictly preserved unless overrideCustom is selected.

      // Admins are inherently exempt from quotas
      const updatesPerUser = allUsers.filter(u => !u.isAdmin).map(u => {
        const isVip = u.hasCustomQuota === true;

        if (overrideCustom || !isVip) {
          // Standard user or forced override
          return {
            user: u,
            payload: {
              ...quotaFields,
              ...(overrideCustom ? { hasCustomQuota: false } : {})
            }
          };
        }

        // VIP User with Upward-Only Benefits:
        if (!quotaFields.isQuotaActive) {
          // Benefit 1: If admin lifted limits for everyone, VIP also gets Unlimited!
          return {
            user: u,
            payload: {
              isQuotaActive: false
            }
          };
        }

        // Benefit 2: Admin set active limits -> VIP gets the higher/better value (never degraded)
        const currentStorageMB = u.storageQuotaMB !== undefined ? u.storageQuotaMB : 500;
        const currentPages = u.pagesQuota !== undefined ? u.pagesQuota : 100;
        const currentOcr = u.ocrQuota !== undefined ? u.ocrQuota : 50;

        const targetStorageMB = quotaFields.storageQuotaMB !== undefined ? quotaFields.storageQuotaMB : 500;
        const targetPages = quotaFields.pagesQuota !== undefined ? quotaFields.pagesQuota : 100;
        const targetOcr = quotaFields.ocrQuota !== undefined ? quotaFields.ocrQuota : 50;

        const bestStorageMB = Math.max(currentStorageMB, targetStorageMB);
        const bestPages = Math.max(currentPages, targetPages);
        const bestOcr = Math.max(currentOcr, targetOcr);

        return {
          user: u,
          payload: {
            isQuotaActive: true,
            quotaMode: u.quotaMode || quotaFields.quotaMode || 'storage',
            storageQuotaMB: bestStorageMB,
            pagesQuota: bestPages,
            ocrQuota: bestOcr
          }
        };
      });

      const promises = updatesPerUser.map(item => 
        updateDoc(doc(db, 'users', item.user.id), item.payload)
      );
      await Promise.all(promises);

      // 3. Update local state
      const payloadMap = new Map(updatesPerUser.map(i => [i.user.id, i.payload]));
      setAllUsers(prev => prev.map(u => {
        const p = payloadMap.get(u.id);
        return p ? { ...u, ...p } : u;
      }));

      if (user) {
        const myPayload = payloadMap.get(user.id);
        if (myPayload) {
          setUser(prev => prev ? { ...prev, ...myPayload } : prev);
        }
      }
    } catch (e) {
      console.error("Failed to update all users quotas by admin", e);
      throw e;
    }
  };

    const deleteMyAccount = async () => {
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

  const deleteUserDoc = async (userId: string) => {
    if (!user?.isAdmin) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      setAllUsers(prev => prev.filter(u => u.id !== userId));
    } catch (e) {
      console.error("Failed to delete user", e);
    }
  };

  
  const loginWithPhone = async (phone: string, appVerifier: any) => {
    return await signInWithPhoneNumber(auth, phone, appVerifier);
  };
  
  const linkPhoneNumberMock = async (phone: string) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { phone });
      setUser(prev => prev ? { ...prev, phone } : prev);
      setAllUsers(prev => prev.map(u => u.id === user.id ? { ...u, phone } : u));
    } catch (e) {
      console.error('Error linking phone:', e);
      throw e;
    }
  };

  const findUserByPhone = async (phone: string): Promise<UserProfile | null> => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      let foundUser: UserProfile | null = null;
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const cleanDbPhone = (data.phone || '').replace(/\D/g, '');
        const cleanQueryPhone = phone.replace(/\D/g, '');
        if (cleanDbPhone && cleanDbPhone === cleanQueryPhone) {
          foundUser = { ...data, id: docSnap.id } as UserProfile;
        }
      });
      return foundUser;
    } catch (e) {
      console.error('Error finding user by phone:', e);
      return null;
    }
  };

  const findUserById = async (id: string): Promise<UserProfile | null> => {
    try {
      const userSnap = await getDoc(doc(db, 'users', id));
      if (userSnap.exists()) {
        return { ...userSnap.data(), id: userSnap.id } as UserProfile;
      }
      return null;
    } catch (e) {
      console.error('Error finding user by id:', e);
      return null;
    }
  };

  
  
  
  return (
    <AuthContext.Provider value={{ 
      user, allUsers, login, 
      loginWithGoogle, loginWithFacebook, loginWithApple, 
      loginWithEmail, registerWithEmail, resetPassword,
      logout, updateProfile, addContact, blockUser, toggleAdmin, updateUserByAdmin, updateAllUsersQuotasByAdmin, deleteUserDoc, deleteMyAccount, isLoaded,
      loginWithPhone, linkPhoneNumberMock, findUserByPhone, findUserById
    }}>
      {children}
    </AuthContext.Provider>
  );
}



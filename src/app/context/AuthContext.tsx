'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

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
}

interface AuthContextType {
  user: UserProfile | null;
  allUsers: UserProfile[]; // For Admin CRM simulation
  login: (phone: string, realName: string) => void;
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  addContact: (contact: Omit<UserContact, 'addedAt'>) => void;
  blockUser: (userId: string, block: boolean) => void; // Admin action
  isLoaded: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  allUsers: [],
  login: () => {},
  logout: () => {},
  updateProfile: () => {},
  addContact: () => {},
  blockUser: () => {},
  isLoaded: false,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load simulated DB on mount
  useEffect(() => {
    const savedUsers = localStorage.getItem('smartshare_users');
    const savedSession = localStorage.getItem('smartshare_session_id');

    let parsedUsers: UserProfile[] = [];
    if (savedUsers) {
      try {
        parsedUsers = JSON.parse(savedUsers);
        setAllUsers(parsedUsers);
      } catch (e) {
        console.error("Failed to parse users", e);
      }
    }

    if (savedSession) {
      const activeUser = parsedUsers.find(u => u.id === savedSession);
      if (activeUser && !activeUser.isBlocked) {
        setUser(activeUser);
      } else if (activeUser?.isBlocked) {
        // Force logout if blocked
        localStorage.removeItem('smartshare_session_id');
      }
    }

    setIsLoaded(true);
  }, []);

  // Save to simulated DB whenever allUsers changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('smartshare_users', JSON.stringify(allUsers));
      if (user) {
        // Keep active user state in sync with DB
        const updatedUser = allUsers.find(u => u.id === user.id);
        if (updatedUser) setUser(updatedUser);
      }
    }
  }, [allUsers, isLoaded]);

  const login = (phone: string, realName: string) => {
    let existingUser = allUsers.find(u => u.phone === phone);
    
    if (!existingUser) {
      existingUser = {
        id: crypto.randomUUID(),
        realName,
        phone,
        contacts: [],
        isAdmin: phone === '0500000000', // Mock rule: this phone is Super Admin
        createdAt: new Date().toISOString(),
      };
      setAllUsers(prev => [...prev, existingUser!]);
    }

    if (existingUser.isBlocked) {
      alert("משתמש זה חסום במערכת.");
      return;
    }

    setUser(existingUser);
    localStorage.setItem('smartshare_session_id', existingUser.id);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('smartshare_session_id');
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    if (!user) return;
    setAllUsers(prev => prev.map(u => u.id === user.id ? { ...u, ...updates } : u));
  };

  const addContact = (contact: Omit<UserContact, 'addedAt'>) => {
    if (!user) return;
    const newContact: UserContact = { ...contact, addedAt: new Date().toISOString() };
    
    // Check if contact already exists
    if (user.contacts.some(c => c.id === contact.id)) return;

    setAllUsers(prev => prev.map(u => {
      if (u.id === user.id) {
        return { ...u, contacts: [...u.contacts, newContact] };
      }
      return u;
    }));
  };

  const blockUser = (userId: string, block: boolean) => {
    if (!user?.isAdmin) return;
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, isBlocked: block } : u));
  };

  return (
    <AuthContext.Provider value={{
      user,
      allUsers,
      login,
      logout,
      updateProfile,
      addContact,
      blockUser,
      isLoaded
    }}>
      {children}
    </AuthContext.Provider>
  );
}

'use client';

import { createContext, useContext, useState, useEffect } from 'react';

export interface GuestProfile {
  id: string; // Unique id for the device/browser
  name: string;
  avatarUrl?: string;
  status: 'single' | 'married' | 'relationship' | 'complicated' | 'hidden';
}

interface GuestContextType {
  profile: GuestProfile | null;
  saveProfile: (profile: Omit<GuestProfile, 'id'>) => void;
  clearProfile: () => void;
}

const GuestContext = createContext<GuestContextType | undefined>(undefined);

export function GuestProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load from local storage on mount
    const saved = localStorage.getItem('smartshare_guest_profile');
    if (saved) {
      try {
        setProfile(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse guest profile", e);
      }
    }
    setIsLoaded(true);
  }, []);

  const saveProfile = (newProfile: Omit<GuestProfile, 'id'>) => {
    // Keep existing ID or create new one
    const id = profile?.id || Math.random().toString(36).substr(2, 9);
    const fullProfile = { ...newProfile, id };
    
    setProfile(fullProfile);
    localStorage.setItem('smartshare_guest_profile', JSON.stringify(fullProfile));
  };

  const clearProfile = () => {
    setProfile(null);
    localStorage.removeItem('smartshare_guest_profile');
  };

  // Prevent hydration mismatch by not rendering children until local storage is read
  if (!isLoaded) return null; 

  return (
    <GuestContext.Provider value={{ profile, saveProfile, clearProfile }}>
      {children}
    </GuestContext.Provider>
  );
}

export function useGuest() {
  const context = useContext(GuestContext);
  if (context === undefined) {
    throw new Error('useGuest must be used within a GuestProvider');
  }
  return context;
}

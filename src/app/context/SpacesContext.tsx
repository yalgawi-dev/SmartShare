'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AVAILABLE_FEATURES } from '../data/features';

export type FeatureId = string;
export type InvoiceStatus = 'approved' | 'pending' | 'dispute' | 'missing';

export interface Invoice {
  id: string;
  amount: number | null;
  supplier: string | null;
  payerName: string | null;
  date: string;
  status: InvoiceStatus;
  note: string;
  approvalsNeeded: number;
  approvalsReceived: number;
  vatRate: number; // 👈 Locked VAT rate at the time of creation
  category: string; // 👈 Added category
  hasAttachment: boolean; // 👈 Added attachment flag
}

export interface MediaItem {
  id: string;
  type: 'photo' | 'message';
  url?: string; // for photo
  content?: string; // for message
  authorName: string;
  timestamp: string;
  likes: number;
}

export interface SpaceSettings {
  defaultVatRate: number;
  allowPartnersToEditWall: boolean;
}

export interface Space {
  id: string;
  title: string;
  description: string;
  icon: string;
  updatedAt: string;
  features: FeatureId[];
  settings: SpaceSettings;
  invoices: Invoice[];
  mediaItems: MediaItem[];
}

interface SpacesContextType {
  spaces: Space[];
  addSpace: (space: Omit<Space, 'id' | 'updatedAt' | 'settings' | 'invoices' | 'mediaItems'>) => void;
  updateSpaceTitle: (spaceId: string, newTitle: string) => void;
  toggleFeature: (spaceId: string, featureId: FeatureId) => void;
  updateSpaceSettings: (spaceId: string, newSettings: Partial<SpaceSettings>) => void;
  addInvoice: (spaceId: string, invoice: Omit<Invoice, 'id'>) => void;
  addMediaItem: (spaceId: string, item: Omit<MediaItem, 'id' | 'timestamp' | 'likes'>) => void;
}

const defaultSettings: SpaceSettings = {
  defaultVatRate: 18, // 18% is the default current VAT
  allowPartnersToEditWall: false,
};

const initialSpaces: Space[] = [
  {
    id: '1',
    title: 'בניית הבית בכפר',
    description: 'ניהול הוצאות, קבלנים, העלאת חשבוניות ותוכניות אדריכליות במקום אחד.',
    icon: '🏠',
    updatedAt: 'לפני 2 דקות',
    features: ['finance', 'scanner', 'partners'],
    settings: defaultSettings,
    invoices: [
      { id: 'inv-1', amount: 1180, supplier: 'הום סנטר - חומרי בניין', payerName: 'דני (אני)', date: '25/07/2026', status: 'pending', note: 'קניתי מלט וברזלים לפי בקשת הקבלן. ממתין לאישורכם.', approvalsNeeded: 2, approvalsReceived: 1, vatRate: 18, category: 'חומרי בניין', hasAttachment: true },
      { id: 'inv-2', amount: 450, supplier: 'קבלן חשמל', payerName: 'יוסי', date: '24/07/2026', status: 'dispute', note: 'תשלום על נקודות החשמל הנוספות בסלון.', approvalsNeeded: 2, approvalsReceived: 0, vatRate: 18, category: 'קבלנים', hasAttachment: false },
    ],
    mediaItems: [],
  },
];

const SpacesContext = createContext<SpacesContextType | undefined>(undefined);

export function SpacesProvider({ children }: { children: ReactNode }) {
  // Initialize from LocalStorage or use defaults
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedSpaces = localStorage.getItem('smartshare_spaces');
    if (savedSpaces) {
      setSpaces(JSON.parse(savedSpaces));
    } else {
      setSpaces(initialSpaces);
    }
    setIsLoaded(true);
  }, []);

  // Save to LocalStorage whenever spaces change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('smartshare_spaces', JSON.stringify(spaces));
    }
  }, [spaces, isLoaded]);

  const addSpace = (spaceData: Omit<Space, 'id' | 'updatedAt' | 'settings' | 'invoices' | 'mediaItems'>) => {
    const newSpace: Space = {
      ...spaceData,
      id: crypto.randomUUID(),
      updatedAt: 'נוצר הרגע',
      settings: defaultSettings,
      invoices: [],
      mediaItems: [],
    };
    setSpaces(prev => [newSpace, ...prev]);
  };

  const toggleFeature = (spaceId: string, featureId: FeatureId) => {
    setSpaces(prev => prev.map(space => {
      if (space.id === spaceId) {
        const hasFeature = space.features.includes(featureId);
        return {
          ...space,
          features: hasFeature 
            ? space.features.filter(f => f !== featureId) 
            : [...space.features, featureId],
          updatedAt: 'ממש עכשיו'
        };
      }
      return space;
    }));
  };

  const updateSpaceTitle = (spaceId: string, newTitle: string) => {
    setSpaces(prev => prev.map(space => {
      if (space.id === spaceId) {
        return { ...space, title: newTitle, updatedAt: 'עודכן עכשיו' };
      }
      return space;
    }));
  };

  const updateSpaceSettings = (spaceId: string, newSettings: Partial<SpaceSettings>) => {
    setSpaces(prev => prev.map(space => {
      if (space.id === spaceId) {
        return {
          ...space,
          settings: { ...space.settings, ...newSettings },
          updatedAt: 'עודכן עכשיו'
        };
      }
      return space;
    }));
  };

  const addInvoice = (spaceId: string, invoiceData: Omit<Invoice, 'id'>) => {
    setSpaces(prev => prev.map(space => {
      if (space.id === spaceId) {
        const newInvoice: Invoice = {
          ...invoiceData,
          id: `inv-${Date.now()}`
        };
        return {
          ...space,
          invoices: [newInvoice, ...space.invoices],
          updatedAt: 'עודכן עכשיו'
        };
      }
      return space;
    }));
  }

  const addMediaItem = (spaceId: string, item: Omit<MediaItem, 'id' | 'timestamp' | 'likes'>) => {
    setSpaces(prev => prev.map(space => {
      if (space.id === spaceId) {
        const newItem: MediaItem = {
          ...item,
          id: crypto.randomUUID(),
          timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
          likes: 0
        };
        return {
          ...space,
          mediaItems: [newItem, ...(space.mediaItems || [])] // Prepend new items
        };
      }
      return space;
    }));
  };

  return (
    <SpacesContext.Provider value={{ spaces, addSpace, updateSpaceTitle, toggleFeature, updateSpaceSettings, addInvoice, addMediaItem }}>
      {children}
    </SpacesContext.Provider>
  );
}

export function useSpaces() {
  const context = useContext(SpacesContext);
  if (context === undefined) {
    throw new Error('useSpaces must be used within a SpacesProvider');
  }
  return context;
}

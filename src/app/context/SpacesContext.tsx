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

export interface Comment {
  id: string;
  authorName: string;
  avatarUrl?: string;
  text: string;
  timestamp: string;
}

export interface MediaItem {
  id: string;
  type: 'photo' | 'video' | 'message';
  url?: string;
  avatarUrl?: string; // Add avatar support for authors
  authorStatus?: string; // Add status for profile inspection
  content?: string;
  authorName: string;
  timestamp: string;
  likes: number;
  comments?: Comment[];
}

export interface SpaceSettings {
  defaultVatRate: number;
  allowPartnersToEditWall: boolean;
}

export interface SpaceMember {
  userId: string;
  name: string; // the name when added
  canUpload: boolean;
  canDelete: boolean;
  canEdit: boolean;
  localAvatarUrl?: string; // per-space avatar override
  useNickname?: boolean; // per-space nickname preference override
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
  members: SpaceMember[];
  date?: string;
  coverImage?: string;
}

interface SpacesContextType {
  spaces: Space[];
  addSpace: (space: Omit<Space, 'id' | 'updatedAt' | 'settings' | 'invoices' | 'mediaItems' | 'date' | 'coverImage'>) => void;
  updateSpaceTitle: (spaceId: string, newTitle: string) => void;
  updateSpaceDate: (spaceId: string, newDate: string) => void;
  updateSpaceCover: (spaceId: string, newCoverUrl: string) => void;
  toggleFeature: (spaceId: string, featureId: FeatureId) => void;
  updateSpaceSettings: (spaceId: string, newSettings: Partial<SpaceSettings>) => void;
  addInvoice: (spaceId: string, invoice: Omit<Invoice, 'id'>) => void;
  addMediaItem: (spaceId: string, item: Omit<MediaItem, 'id' | 'timestamp' | 'likes'>) => void;
  removeMediaItem: (spaceId: string, mediaId: string) => void;
  likeMediaItem: (spaceId: string, mediaId: string) => void;
  addComment: (spaceId: string, mediaId: string, comment: Omit<Comment, 'id' | 'timestamp'>) => void;
  updateMemberPermissions: (spaceId: string, userId: string, permissions: Partial<SpaceMember>) => void;
  joinSpace: (spaceId: string, userId: string, name: string) => void;
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
    members: [],
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

  const addSpace = (spaceData: Omit<Space, 'id' | 'updatedAt' | 'settings' | 'invoices' | 'mediaItems' | 'date' | 'coverImage'>) => {
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

  const updateSpaceDate = (spaceId: string, newDate: string) => {
    setSpaces(prev => prev.map(space => {
      if (space.id === spaceId) {
        return { ...space, date: newDate, updatedAt: 'עודכן עכשיו' };
      }
      return space;
    }));
  };

  const updateSpaceCover = (spaceId: string, newCoverUrl: string) => {
    setSpaces(prev => prev.map(space => {
      if (space.id === spaceId) {
        return { ...space, coverImage: newCoverUrl, updatedAt: 'עודכן עכשיו' };
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
        return {
          ...space,
          mediaItems: [
            { ...item, id: Math.random().toString(36).substr(2, 9), timestamp: 'ממש עכשיו', likes: 0 },
            ...(space.mediaItems || [])
          ],
          updatedAt: 'עודכן עכשיו'
        };
      }
      return space;
    }));
  };

  const removeMediaItem = (spaceId: string, mediaId: string) => {
    setSpaces(prev => prev.map(space => {
      if (space.id === spaceId) {
        return {
          ...space,
          mediaItems: (space.mediaItems || []).filter(item => item.id !== mediaId),
          updatedAt: 'עודכן עכשיו'
        };
      }
      return space;
    }));
  };

  const likeMediaItem = (spaceId: string, mediaId: string) => {
    setSpaces(prev => prev.map(space => {
      if (space.id === spaceId) {
        return {
          ...space,
          mediaItems: (space.mediaItems || []).map(item => 
            item.id === mediaId ? { ...item, likes: (item.likes || 0) + 1 } : item
          )
        };
      }
      return space;
    }));
  };

  const addComment = (spaceId: string, mediaId: string, comment: Omit<Comment, 'id' | 'timestamp'>) => {
    setSpaces(prev => prev.map(space => {
      if (space.id === spaceId) {
        return {
          ...space,
          mediaItems: (space.mediaItems || []).map(item => {
            if (item.id === mediaId) {
              const newComment: Comment = {
                ...comment,
                id: Math.random().toString(36).substr(2, 9),
                timestamp: 'ממש עכשיו'
              };
              return { ...item, comments: [...(item.comments || []), newComment] };
            }
            return item;
          })
        };
      }
      return space;
    }));
  };

  const joinSpace = (spaceId: string, userId: string, name: string) => {
    setSpaces(prev => prev.map(space => {
      if (space.id === spaceId) {
        if (space.members?.some(m => m.userId === userId)) return space; // already joined
        return {
          ...space,
          members: [...(space.members || []), {
            userId,
            name,
            canUpload: true,
            canDelete: false,
            canEdit: false,
          }]
        };
      }
      return space;
    }));
  };

  const updateMemberPermissions = (spaceId: string, userId: string, permissions: Partial<SpaceMember>) => {
    setSpaces(prev => prev.map(space => {
      if (space.id === spaceId) {
        return {
          ...space,
          members: (space.members || []).map(m => m.userId === userId ? { ...m, ...permissions } : m)
        };
      }
      return space;
    }));
  };

  return (
    <SpacesContext.Provider value={{ spaces, addSpace, updateSpaceTitle, updateSpaceDate, updateSpaceCover, toggleFeature, updateSpaceSettings, addInvoice, addMediaItem, removeMediaItem, likeMediaItem,      addComment,
      updateMemberPermissions,
      joinSpace
    }}>
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

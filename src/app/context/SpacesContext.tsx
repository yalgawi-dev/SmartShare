'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { AVAILABLE_FEATURES } from '../data/features';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

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
  vatRate: number; 
  category: string; 
  hasAttachment: boolean; 
  attachmentUrl?: string;
  payerId?: string;
  vatNumber?: string;
    documentType?: string;
  invoiceNumber?: string;
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
  avatarUrl?: string; 
  authorStatus?: string; 
  content?: string;
  authorName: string;
  authorId?: string;
  timestamp: string;
  likes: number;
  comments?: Comment[];
  fontFamily?: string;
  backgroundColor?: string;
  rotation?: number;
  isCard?: boolean;
  stickerId?: string;
  stickerPosition?: string;
  signatureUrl?: string;
  
  // Canvas Editor Properties
  x?: number;
  y?: number;
  scale?: number;
  width?: number;
  height?: number;
  pageIndex?: number;
  zIndex?: number;

  slotIndex?: number;
  attachedPhotoUrl?: string;
}

export interface SpaceSettings {
  defaultVatRate: number;
  allowPartnersToEditWall: boolean;
  mySharePercentage?: number;
}

export interface SpaceMember {
  userId: string;
  name: string; 
  canUpload: boolean;
  canDelete: boolean;
  canEdit: boolean;
  localAvatarUrl?: string; 
  useNickname?: boolean; 
  sharePercentage?: number;
  isActive?: boolean;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  actionType: 'MEMBER_LEFT' | 'MEMBER_REMOVED' | 'SHARES_UPDATED' | 'AUTO_BALANCE' | 'OTHER';
  performedBy: string; // userId of who performed the action
  details: string; // Human readable explanation
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
  auditLogs?: AuditRecord[];
  date?: string;
  coverImage?: string;
  albumSize?: 'A3-landscape' | 'A4-landscape' | 'A4-portrait' | 'square';
  albumAtmospherePhotos?: string[];
  status?: 'active' | 'pending_deletion';
  deletionScheduledFor?: string;
}

interface SpacesContextType {
  spaces: Space[];
  addSpace: (space: Omit<Space, 'id' | 'updatedAt' | 'settings' | 'invoices' | 'mediaItems' | 'date' | 'coverImage'>) => void;
  deleteSpace: (spaceId: string) => void;
  restoreSpace: (spaceId: string) => void;
  updateSpaceTitle: (spaceId: string, newTitle: string) => void;
  updateSpaceDate: (spaceId: string, newDate: string) => void;
  updateSpaceCover: (spaceId: string, newCoverUrl: string) => void;
  updateSpaceIcon: (spaceId: string, newIcon: string) => void;
  toggleFeature: (spaceId: string, featureId: FeatureId) => void;
  updateSpaceSettings: (spaceId: string, newSettings: Partial<SpaceSettings>) => void;
  addInvoice: (spaceId: string, invoice: Omit<Invoice, 'id'>) => void;
  addMediaItem: (spaceId: string, item: Omit<MediaItem, 'id' | 'timestamp' | 'likes'>) => void;
  updateMediaItem: (spaceId: string, mediaId: string, updates: Partial<MediaItem>) => void;
  removeMediaItem: (spaceId: string, mediaId: string) => void;
  likeMediaItem: (spaceId: string, mediaId: string) => void;
  addComment: (spaceId: string, mediaId: string, comment: Omit<Comment, 'id' | 'timestamp'>) => void;
  deleteComment: (spaceId: string, mediaId: string, commentId: string) => void;
  updateMemberPermissions: (spaceId: string, userId: string, permissions: Partial<SpaceMember>) => void;
  removeMember: (spaceId: string, userId: string, performedBy: string) => void;
  restoreMember: (spaceId: string, userId: string, performedBy: string) => void;
  autoBalanceShares: (spaceId: string, performedBy: string) => void;
  addAuditLog: (spaceId: string, log: Omit<AuditRecord, 'id' | 'timestamp'>) => void;
  joinSpace: (spaceId: string, userId: string, name: string) => void;
  updateAlbumSettings: (spaceId: string, size: 'A3-landscape' | 'A4-landscape' | 'A4-portrait' | 'square', newPhotos: string[]) => void;
  updateAtmospherePhoto: (spaceId: string, index: number, newUrl: string) => void;
  moveMediaItem: (spaceId: string, mediaId: string, newPageNumber: number, newSlotIndex: number) => void;
  isLoaded: boolean;
}

const defaultSettings: SpaceSettings = {
  defaultVatRate: 18, 
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
    invoices: [],
    mediaItems: [],
    members: [],
  },
];

const SpacesContext = createContext<SpacesContextType | undefined>(undefined);

export function SpacesProvider({ children }: { children: ReactNode }) {
  const [spacesBase, setSpacesBase] = useState<Omit<Space, 'mediaItems'>[]>([]);
  const [mediaItemsBySpace, setMediaItemsBySpace] = useState<Record<string, MediaItem[]>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const mediaUnsubscribes = useRef<Record<string, () => void>>({});

  useEffect(() => {
    const spacesRef = collection(db, 'spaces');
    const unsubscribeSpaces = onSnapshot(spacesRef, (snapshot) => {
      const dbSpaces = snapshot.docs.map(doc => {
        const data = doc.data();
        // ensure mediaItems are not pulled from root doc anymore if they exist there legacy
        delete data.mediaItems; 
        return { id: doc.id, ...data } as Omit<Space, 'mediaItems'>;
      });
      
      // Look for any spaces in localStorage that aren't in Firestore yet
      let spacesToUpload: Space[] = [];
      const savedSpaces = localStorage.getItem('smartshare_spaces');
      if (savedSpaces) {
        try {
          const parsed = JSON.parse(savedSpaces);
          if (Array.isArray(parsed)) {
            parsed.forEach(localSpace => {
              if (!dbSpaces.find(dbS => dbS.id === localSpace.id)) {
                spacesToUpload.push(localSpace);
              }
            });
          }
        } catch (e) {
          console.error("Failed to parse local spaces during migration", e);
        }
      }

      if (dbSpaces.length === 0 && spacesToUpload.length === 0) {
        spacesToUpload = initialSpaces;
      }

      if (spacesToUpload.length > 0) {
        spacesToUpload.forEach(space => {
          const spaceWithoutMedia = { ...space };
          const legacyMediaItems = spaceWithoutMedia.mediaItems || [];
          delete (spaceWithoutMedia as any).mediaItems;

          setDoc(doc(db, 'spaces', space.id), spaceWithoutMedia).catch(console.error);
          dbSpaces.push(spaceWithoutMedia);
          
          // Migrate legacy mediaItems to subcollection
          if (legacyMediaItems.length > 0) {
            legacyMediaItems.forEach(item => {
               setDoc(doc(db, 'spaces', space.id, 'mediaItems', item.id), item).catch(console.error);
            });
          }
        });
      }

      setSpacesBase(dbSpaces);
      
      // Setup mediaItems listeners for all spaces
      dbSpaces.forEach(space => {
        if (!mediaUnsubscribes.current[space.id]) {
          const mediaRef = collection(db, 'spaces', space.id, 'mediaItems');
          const unsub = onSnapshot(mediaRef, (mediaSnap) => {
            const items = mediaSnap.docs.map(d => ({ id: d.id, ...d.data() } as MediaItem));
            setMediaItemsBySpace(prev => ({
              ...prev,
              [space.id]: items
            }));
          });
          mediaUnsubscribes.current[space.id] = unsub;
        }
      });

      setIsLoaded(true);
    }, (error) => {
       console.error("Firestore error:", error);
       const savedSpaces = localStorage.getItem('smartshare_spaces');
       if (savedSpaces) {
         const parsed = JSON.parse(savedSpaces) as Space[];
         setSpacesBase(parsed.map(s => {
           const sc = {...s}; delete (sc as any).mediaItems; return sc;
         }));
         const mediaMap: Record<string, MediaItem[]> = {};
         parsed.forEach(s => mediaMap[s.id] = s.mediaItems || []);
         setMediaItemsBySpace(mediaMap);
       }
       setIsLoaded(true);
    });

    return () => {
      unsubscribeSpaces();
      Object.values(mediaUnsubscribes.current).forEach(unsub => unsub());
    };
  }, []);

  // Compute final spaces array for context consumers
  const spaces: Space[] = spacesBase.map(base => ({
    ...base,
    mediaItems: mediaItemsBySpace[base.id] || []
  }));

  // Helper function to update Space ROOT document
  const saveSpaceUpdate = async (spaceId: string, mutator: (space: Omit<Space, 'mediaItems'>) => Omit<Space, 'mediaItems'>) => {
    let updatedSpace: Omit<Space, 'mediaItems'> | null = null;
    
    setSpacesBase(prev => {
      return prev.map(space => {
        if (space.id === spaceId) {
          updatedSpace = mutator(space);
          return updatedSpace;
        }
        return space;
      });
    });

    if (updatedSpace) {
      try {
        await setDoc(doc(db, 'spaces', spaceId), updatedSpace);
      } catch (e) {
        console.error("Error updating Firestore space root", e);
      }
    }
  };

  const addSpace = (spaceData: Omit<Space, 'id' | 'updatedAt' | 'settings' | 'invoices' | 'mediaItems' | 'date' | 'coverImage'>) => {
    const newSpace: Omit<Space, 'mediaItems'> = {
      ...spaceData,
      id: crypto.randomUUID(),
      updatedAt: 'נוצר הרגע',
      settings: defaultSettings,
      invoices: [],
      members: [],
    };
    setSpacesBase(prev => [newSpace, ...prev]);
    setDoc(doc(db, 'spaces', newSpace.id), newSpace).catch(console.error);
  };

  const deleteSpace = (spaceId: string) => {
    saveSpaceUpdate(spaceId, space => {
      if (!space.invoices || space.invoices.length === 0) {
        // Hard Delete
        deleteDoc(doc(db, 'spaces', spaceId)).catch(console.error);
        setSpacesBase(prev => prev.filter(s => s.id !== spaceId));
        return space;
      }
      
      // Soft Delete / Archive
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14); // 14 days grace period
      return {
        ...space,
        status: 'pending_deletion',
        deletionScheduledFor: futureDate.toISOString()
      };
    });
  };

  const restoreSpace = (spaceId: string) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      status: 'active',
      deletionScheduledFor: undefined
    }));
  };

  const toggleFeature = (spaceId: string, featureId: FeatureId) => {
    saveSpaceUpdate(spaceId, space => {
      const hasFeature = space.features.includes(featureId);
      return {
        ...space,
        features: hasFeature ? space.features.filter(f => f !== featureId) : [...space.features, featureId],
        updatedAt: 'ממש עכשיו'
      };
    });
  };

  const updateSpaceTitle = (spaceId: string, newTitle: string) => {
    saveSpaceUpdate(spaceId, space => ({ ...space, title: newTitle, updatedAt: 'עודכן עכשיו' }));
  };

  const updateSpaceDate = (spaceId: string, newDate: string) => {
    saveSpaceUpdate(spaceId, space => ({ ...space, date: newDate, updatedAt: 'עודכן עכשיו' }));
  };

  const updateSpaceCover = (spaceId: string, newCoverUrl: string) => {
    saveSpaceUpdate(spaceId, space => ({ ...space, coverImage: newCoverUrl, updatedAt: 'עודכן עכשיו' }));
  };

  const updateSpaceIcon = (spaceId: string, newIcon: string) => {
    saveSpaceUpdate(spaceId, space => ({ ...space, icon: newIcon, updatedAt: 'עודכן עכשיו' }));
  };

  const updateSpaceSettings = (spaceId: string, newSettings: Partial<SpaceSettings>) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      settings: { ...space.settings, ...newSettings },
      updatedAt: 'עודכן עכשיו'
    }));
  };

  const addInvoice = (spaceId: string, invoiceData: Omit<Invoice, 'id'>) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      invoices: [{ ...invoiceData, id: `inv-${Date.now()}` }, ...space.invoices],
      updatedAt: 'עודכן עכשיו'
    }));
  };

  const joinSpace = (spaceId: string, userId: string, name: string) => {
    saveSpaceUpdate(spaceId, space => {
      if (space.members?.some(m => m.userId === userId)) return space; 
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
    });
  };

  const updateMemberPermissions = (spaceId: string, userId: string, permissions: Partial<SpaceMember>) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      members: (space.members || []).map(m => m.userId === userId ? { ...m, ...permissions } : m)
    }));
  };

  const addAuditLog = (spaceId: string, log: Omit<AuditRecord, 'id' | 'timestamp'>) => {
    saveSpaceUpdate(spaceId, space => {
      const newLog: AuditRecord = {
        ...log,
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString()
      };
      return {
        ...space,
        auditLogs: [newLog, ...(space.auditLogs || [])]
      };
    });
  };

  const autoBalanceShares = (spaceId: string, performedBy: string) => {
    saveSpaceUpdate(spaceId, space => {
      const activeMembers = space.members?.filter(m => m.isActive !== false) || [];
      const memberCount = activeMembers.length + 1; // +1 for the creator/me
      const defaultShare = 100 / memberCount;
      
      const newMembers = (space.members || []).map(m => {
        if (m.isActive === false) return { ...m, sharePercentage: 0 };
        return { ...m, sharePercentage: defaultShare };
      });

      const newLog: AuditRecord = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        actionType: 'AUTO_BALANCE',
        performedBy,
        details: `המערכת חילקה את האחוזים שווה בשווה (${defaultShare.toFixed(1)}% לכל אחד) עבור ${memberCount} משתתפים פעילים.`
      };

      return {
        ...space,
        settings: { ...space.settings, mySharePercentage: defaultShare },
        members: newMembers,
        auditLogs: [newLog, ...(space.auditLogs || [])]
      };
    });
  };

  const removeMember = (spaceId: string, userId: string, performedBy: string) => {
    saveSpaceUpdate(spaceId, space => {
      const memberToRemove = space.members?.find(m => m.userId === userId);
      if (!memberToRemove) return space;

      const hasInvoices = space.invoices?.some(i => i.payerId === userId);
      let newMembers;
      let actionType: 'MEMBER_REMOVED' | 'MEMBER_LEFT' = 'MEMBER_REMOVED';
      let details = '';

      if (hasInvoices) {
        // Soft delete
        newMembers = space.members?.map(m => m.userId === userId ? { ...m, isActive: false } : m) || [];
        details = `השותף ${memberToRemove.name} סומן כלא-פעיל (יש לו היסטוריית תשלומים). האחוזים יאופסו.`;
      } else {
        // Hard delete
        newMembers = space.members?.filter(m => m.userId !== userId) || [];
        details = `השותף ${memberToRemove.name} הוסר מהמרחב לחלוטין. האחוזים יאופסו.`;
      }
      
      const newLog: AuditRecord = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        actionType,
        performedBy,
        details
      };

      return {
        ...space,
        members: newMembers,
        auditLogs: [newLog, ...(space.auditLogs || [])]
      };
    });
    
    // Auto balance after removing
    setTimeout(() => {
      autoBalanceShares(spaceId, performedBy);
    }, 100);
  };

  const restoreMember = (spaceId: string, userId: string, performedBy: string) => {
    saveSpaceUpdate(spaceId, space => {
      const memberToRestore = space.members?.find(m => m.userId === userId);
      if (!memberToRestore) return space;

      const newMembers = space.members?.map(m => m.userId === userId ? { ...m, isActive: true } : m) || [];
      
      const newLog: AuditRecord = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        actionType: 'OTHER',
        performedBy,
        details: `השותף ${memberToRestore.name} הוחזר לפעילות.`
      };

      return {
        ...space,
        members: newMembers,
        auditLogs: [newLog, ...(space.auditLogs || [])]
      };
    });
    
    setTimeout(() => {
      autoBalanceShares(spaceId, performedBy);
    }, 100);
  };

  const updateAlbumSettings = (spaceId: string, size: 'A3-landscape' | 'A4-landscape' | 'A4-portrait' | 'square', newPhotos: string[]) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      albumSize: size,
      albumAtmospherePhotos: [...(space.albumAtmospherePhotos || []), ...newPhotos]
    }));
  };

  const updateAtmospherePhoto = (spaceId: string, index: number, newUrl: string) => {
    saveSpaceUpdate(spaceId, space => {
      const newPhotos = [...(space.albumAtmospherePhotos || [])];
      newPhotos[index] = newUrl;
      return { ...space, albumAtmospherePhotos: newPhotos };
    });
  };

  // --- SUBCOLLECTION MUTATORS (MediaItems / Greetings) ---

  const addMediaItem = (spaceId: string, item: Omit<MediaItem, 'id' | 'timestamp' | 'likes'>) => {
    const newItem: MediaItem = { 
      ...item, 
      id: Math.random().toString(36).substr(2, 9), 
      timestamp: new Date().toISOString(), 
      likes: 0 
    };
    
    // Optimistic UI update
    setMediaItemsBySpace(prev => ({
      ...prev,
      [spaceId]: [...(prev[spaceId] || []), newItem]
    }));

    // Save to Firestore subcollection
    setDoc(doc(db, 'spaces', spaceId, 'mediaItems', newItem.id), newItem).catch(console.error);
  };

  const updateMediaItem = (spaceId: string, mediaId: string, updates: Partial<MediaItem>) => {
    // Optimistic update
    setMediaItemsBySpace(prev => ({
      ...prev,
      [spaceId]: (prev[spaceId] || []).map(item => item.id === mediaId ? { ...item, ...updates } : item)
    }));

    // Update Firestore subcollection
    updateDoc(doc(db, 'spaces', spaceId, 'mediaItems', mediaId), updates).catch(console.error);
  };

  const removeMediaItem = (spaceId: string, mediaId: string) => {
    setMediaItemsBySpace(prev => ({
      ...prev,
      [spaceId]: (prev[spaceId] || []).filter(item => item.id !== mediaId)
    }));

    deleteDoc(doc(db, 'spaces', spaceId, 'mediaItems', mediaId)).catch(console.error);
  };

  const likeMediaItem = (spaceId: string, mediaId: string) => {
    const spaceItems = mediaItemsBySpace[spaceId] || [];
    const itemToLike = spaceItems.find(i => i.id === mediaId);
    if (!itemToLike) return;

    const newLikes = (itemToLike.likes || 0) + 1;
    
    setMediaItemsBySpace(prev => ({
      ...prev,
      [spaceId]: prev[spaceId].map(item => item.id === mediaId ? { ...item, likes: newLikes } : item)
    }));

    updateDoc(doc(db, 'spaces', spaceId, 'mediaItems', mediaId), { likes: newLikes }).catch(console.error);
  };

  const addComment = (spaceId: string, mediaId: string, comment: Omit<Comment, 'id' | 'timestamp'>) => {
    const spaceItems = mediaItemsBySpace[spaceId] || [];
    const targetItem = spaceItems.find(i => i.id === mediaId);
    if (!targetItem) return;

    const newComment: Comment = { 
      ...comment, 
      id: Math.random().toString(36).substr(2, 9), 
      timestamp: new Date().toISOString() 
    };
    
    const updatedComments = [...(targetItem.comments || []), newComment];

    setMediaItemsBySpace(prev => ({
      ...prev,
      [spaceId]: prev[spaceId].map(item => {
        if (item.id === mediaId) {
          return { ...item, comments: updatedComments };
        }
        return item;
      })
    }));

    updateDoc(doc(db, 'spaces', spaceId, 'mediaItems', mediaId), { comments: updatedComments }).catch(console.error);
  };

  const deleteComment = (spaceId: string, mediaId: string, commentId: string) => {
    const spaceItems = mediaItemsBySpace[spaceId] || [];
    const targetItem = spaceItems.find(i => i.id === mediaId);
    if (!targetItem) return;

    const updatedComments = (targetItem.comments || []).filter(c => c.id !== commentId);

    setMediaItemsBySpace(prev => ({
      ...prev,
      [spaceId]: prev[spaceId].map(item => {
        if (item.id === mediaId) return { ...item, comments: updatedComments };
        return item;
      })
    }));

    updateDoc(doc(db, 'spaces', spaceId, 'mediaItems', mediaId), { comments: updatedComments }).catch(console.error);
  };

  const moveMediaItem = (spaceId: string, mediaId: string, newPageNumber: number, newSlotIndex: number) => {
    setMediaItemsBySpace(prev => ({
      ...prev,
      [spaceId]: (prev[spaceId] || []).map(media => {
        if (media.id !== mediaId) return media;
        return { ...media, pageNumber: newPageNumber, slotIndex: newSlotIndex }; 
      })
    }));

    updateDoc(doc(db, 'spaces', spaceId, 'mediaItems', mediaId), { 
      pageNumber: newPageNumber, 
      slotIndex: newSlotIndex 
    }).catch(console.error);
  };

  return (
    <SpacesContext.Provider value={{ spaces, addSpace, deleteSpace, restoreSpace, updateSpaceTitle, updateSpaceDate, updateSpaceCover, updateSpaceIcon, toggleFeature, updateSpaceSettings, addInvoice, addMediaItem, updateMediaItem, removeMediaItem, likeMediaItem, joinSpace,
      updateMemberPermissions,
      addComment,
      deleteComment,
      removeMember,
      restoreMember,
      autoBalanceShares,
      addAuditLog,
      updateAlbumSettings,
      updateAtmospherePhoto,
      moveMediaItem,
      isLoaded
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

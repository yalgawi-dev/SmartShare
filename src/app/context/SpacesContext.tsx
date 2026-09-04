'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { AVAILABLE_FEATURES } from '../data/features';
import { isPartnerExpired } from '../../utils/partnerUtils';
import { useAuth } from './AuthContext';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

export type FeatureId = string;
export type InvoiceStatus = 'approved' | 'pending' | 'dispute' | 'missing';

export interface Invoice {
  excludedMembers?: string[];
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
  pendingExpirationHours?: number;
  defaultVatRate: number;
  allowPartnersToEditWall: boolean;
  mySharePercentage?: number;
}

export interface SpaceMember {
  status?: 'active' | 'pending' | 'disputed';
  disputeMessage?: string;
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
  actionType: 'MEMBER_LEFT' | 'MEMBER_REMOVED' | 'SHARES_UPDATED' | 'AUTO_BALANCE' | 'EDIT_INVOICE' | 'DELETE_INVOICE' | 'OTHER';
  performedBy: string; // userId of who performed the action
  details: string; // Human readable explanation
  invoiceId?: string;
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
  updateSharesBulk: (spaceId: string, myShare: number, partnerShares: Record<string, number>) => void;
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
  updateInvoice: (spaceId: string, invoiceId: string, updates: Partial<Invoice>, performedBy?: string, actionDetail?: string) => void;
  addInvoice: (spaceId: string, invoice: Omit<Invoice, 'id'>) => void;
  addMediaItem: (spaceId: string, item: Omit<MediaItem, 'id' | 'timestamp' | 'likes'>) => void;
  updateMediaItem: (spaceId: string, mediaId: string, updates: Partial<MediaItem>) => void;
  removeMediaItem: (spaceId: string, mediaId: string) => void;
  likeMediaItem: (spaceId: string, mediaId: string) => void;
  addComment: (spaceId: string, mediaId: string, comment: Omit<Comment, 'id' | 'timestamp'>) => void;
  deleteComment: (spaceId: string, mediaId: string, commentId: string) => void;
  updateMemberPermissions: (spaceId: string, userId: string, permissions: Partial<SpaceMember>) => void;
  updateMemberStatus: (spaceId: string, userId: string, status: 'active' | 'pending' | 'disputed', message?: string) => void;
  migrateGuestToRealUser: (spaceId: string, shadowToken: string, realUid: string, realName: string) => void;
  refreshMemberInvite: (spaceId: string, userId: string) => void;
  removeMember: (spaceId: string, userId: string, performedBy: string, forceHardDelete?: boolean) => void;
  restoreMember: (spaceId: string, userId: string, performedBy: string) => void;
  autoBalanceShares: (spaceId: string, performedBy: string) => void;
  devResetSpace: (spaceId: string, currentUserId: string) => void;
  addAuditLog: (spaceId: string, log: Omit<AuditRecord, 'id' | 'timestamp'>) => void;
  joinSpace: (spaceId: string, userId: string, name: string) => void;
  getRoleForSpace: (spaceId: string) => 'creator' | 'partner' | 'none';
  finalizeGuestJoin: (spaceId: string, name: string, isRetroactive: boolean, shadowToken: string, customShare?: number) => void;
  updateAlbumSettings: (spaceId: string, size: 'A3-landscape' | 'A4-landscape' | 'A4-portrait' | 'square', newPhotos: string[]) => void;
  updateAtmospherePhoto: (spaceId: string, index: number, newUrl: string) => void;
  moveMediaItem: (spaceId: string, mediaId: string, newPageNumber: number, newSlotIndex: number) => void;
  isLoaded: boolean;
}

const defaultSettings: SpaceSettings = {
  pendingExpirationHours: 1,
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
  const { user } = useAuth();
  const [spacesBase, setSpacesBase] = useState<Omit<Space, 'mediaItems'>[]>([]);
  const [mediaItemsBySpace, setMediaItemsBySpace] = useState<Record<string, MediaItem[]>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const mediaUnsubscribes = useRef<Record<string, () => void>>({});

  const getRoleForSpace = (spaceId: string): 'creator' | 'partner' | 'none' => {
    // 1. Check Auth Context (Single Source of Truth)
    if (user && user.spaceKeys && user.spaceKeys[spaceId]) {
      return user.spaceKeys[spaceId].role;
    }
    // 2. Check Local Storage (Fallback for anonymous / pre-sync users)
    if (typeof window !== 'undefined') {
      try {
        const localKeys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
        if (localKeys[spaceId]) return localKeys[spaceId].role;
      } catch(e) {}
    }
    
    // TEMPORARY FALLBACK DURING MIGRATION OF OLD SPACES: 
    const space = spacesBase.find(s => s.id === spaceId);
    if (space && !space.masterKey) {
       if ((space as any).creatorId === (user?.id || 'me') || (space as any).createdBy === (user?.id || 'me')) return 'creator';
    }
    
    return 'none';
  };
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
         alert("שגיאת התחברות למסד הנתונים: " + (error.message || ""));
         alert("שגיאת התחברות למסד הנתונים: " + (error.message || ""));
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

  const addSpace = async (spaceData: Omit<Space, 'id' | 'updatedAt' | 'settings' | 'invoices' | 'mediaItems' | 'date' | 'coverImage'>) => {
    const masterKey = 'master_' + crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const newSpace: Omit<Space, 'mediaItems'> = {
      ...spaceData,
      id: crypto.randomUUID(),
      updatedAt: 'נוצר הרגע',
      settings: defaultSettings,
      invoices: [],
      members: [],
      masterKey: masterKey,
    };
    
    // 1. Save to LocalStorage keyring (for guests / robust fallback)
    try {
      const localKeys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
      localKeys[newSpace.id] = { role: 'creator', token: masterKey };
      localStorage.setItem('smartshare_keys', JSON.stringify(localKeys));
    } catch(e) {}
    
    // 2. Save Space to DB
    setSpacesBase(prev => [newSpace, ...prev]);
    await setDoc(doc(db, 'spaces', newSpace.id), newSpace);
    
    // 3. Dispatch an event so AuthContext can sync it to the User Profile
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smartshare_new_key', { detail: { spaceId: newSpace.id, role: 'creator', token: masterKey } }));
    }
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

  const toggleFeature = (spaceId: string, featureId: FeatureId, performedBy?: string) => {
    saveSpaceUpdate(spaceId, space => {
      const hasFeature = space.features.includes(featureId);
      const isRemoving = hasFeature;
      const newFeatures = isRemoving ? space.features.filter(f => f !== featureId) : [...space.features, featureId];
      
      const newSpace = {
        ...space,
        features: newFeatures,
        updatedAt: new Date().toISOString()
      };

      if (performedBy) {
        const featureNameMap: Record<string, string> = {
          'finance': 'התחשבנות',
          'scanner': 'סורק חכם',
          'partners': 'שותפים',
          'guestbook': 'ספר אורחים',
          'gallery': 'גלריה'
        };
        const fName = featureNameMap[featureId] || featureId;
        const newLog: AuditRecord = {
          id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          timestamp: new Date().toISOString(),
          actionType: isRemoving ? 'SYSTEM_ALERT' : 'SYSTEM_ALERT',
          performedBy,
          details: isRemoving ? `הסיר/ה את תוסף "${fName}" מהמרחב` : `הוסיף/ה את תוסף "${fName}" למרחב`
        };
        newSpace.auditLogs = [newLog, ...(space.auditLogs || [])];
      }

      return newSpace;
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

  const updateInvoice = (spaceId: string, invoiceId: string, updates: Partial<Invoice>, performedBy?: string, actionDetail?: string) => {
    saveSpaceUpdate(spaceId, space => {
      const oldInvoice = space.invoices?.find(i => i.id === invoiceId);
      const newInvoices = (space.invoices || []).map(inv => inv.id === invoiceId ? { ...inv, ...updates } : inv);
      
      const newSpace = {
        ...space,
        invoices: newInvoices,
        updatedAt: new Date().toISOString()
      };

      if (performedBy && actionDetail && oldInvoice) {
        const isDelete = updates.isActive === false;
        const isRestore = updates.isActive === true;
        let actionLabel = isDelete ? "מחק/ה הוצאה" : isRestore ? "שחזר/ה הוצאה מחוקה" : "ערך/ה הוצאה";
        const amt = oldInvoice.amount ? ` ע"ס ₪${oldInvoice.amount}` : "";
        const supplier = oldInvoice.supplier || "ספק כללי";
        
        const performer = performedBy === "me" || !performedBy ? "משתמש" : performedBy;
        
        const newLog = {
          id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          timestamp: new Date().toISOString(),
          actionType: isDelete ? "DELETE_INVOICE" : "EDIT_INVOICE",
          performedBy,
          details: `${performer} ${actionLabel}${amt} מאת "${supplier}". פירוט: ${actionDetail}`,
          invoiceId
        };
        newSpace.auditLogs = [newLog, ...(space.auditLogs || [])];
      }

      return newSpace;
    });
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
          isActive: true
        } as any]
      };
    });
  };

  const finalizeGuestJoin = (spaceId: string, name: string, isRetroactive: boolean, shadowToken: string, customShare?: number) => {
    saveSpaceUpdate(spaceId, space => {
      const hasCustomShare = customShare !== undefined && customShare !== null && !isNaN(customShare);
      
      const newMember = {
        userId: shadowToken,
        name,
        role: 'partner' as const,
        joinedAt: new Date().toISOString(),
        isActive: true,
        canUpload: true,
        canEdit: false,
        canDelete: false,
        status: 'pending' as const,
        sharePercentage: hasCustomShare ? customShare : 0,
        isCustomShare: hasCustomShare
      };
      
      let updatedInvoices = space.invoices || [];
      if (!isRetroactive) {
        updatedInvoices = updatedInvoices.map(inv => ({
          ...inv,
          excludedMembers: [...(inv.excludedMembers || []), shadowToken]
        }));
      }
      
      const newMembersList = [...(space.members || []), newMember];
      
      // Atomically balance shares
      const { finalMembers, finalCreatorShare } = calculateBalancedShares(newMembersList, space.settings);
      
      return {
        ...space,
        members: finalMembers,
        settings: { ...space.settings, mySharePercentage: finalCreatorShare },
        invoices: updatedInvoices
      };
    });
  };

  const updateMemberStatus = (spaceId: string, userId: string, status: 'active' | 'pending' | 'disputed', message?: string) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      members: (space.members || []).map(m => m.userId === userId ? { ...m, status, disputeMessage: message || m.disputeMessage } : m)
    }));
  };

  const migrateGuestToRealUser = (spaceId: string, shadowToken: string, realUid: string, realName: string) => {
    saveSpaceUpdate(spaceId, space => {
      // Replace member token with real ID and set to active
      const updatedMembers = (space.members || []).map(m => 
        m.userId === shadowToken ? { ...m, userId: realUid, name: realName, status: 'active' as const, disputeMessage: '' } : m
      );
      
      // Update any invoices that had the shadow token in excludedMembers
      const updatedInvoices = (space.invoices || []).map(inv => ({
        ...inv,
        excludedMembers: (inv.excludedMembers || []).map(id => id === shadowToken ? realUid : id)
      }));
      
      return { ...space, members: updatedMembers as any, invoices: updatedInvoices };
    });
  };

  
  const updateSharesBulk = (spaceId: string, myShare: number, partnerShares: Record<string, number>) => {
    saveSpaceUpdate(spaceId, space => {
      const newMembers = (space.members || []).map(m => {
        if (partnerShares[m.userId] !== undefined) {
          return { ...m, sharePercentage: partnerShares[m.userId], isCustomShare: true };
        }
        return m;
      });
      return {
        ...space,
        members: newMembers,
        settings: { ...space.settings, mySharePercentage: myShare, isCustomShare: true }
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

  const devResetSpace = (spaceId: string, currentUserId: string) => {
    saveSpaceUpdate(spaceId, space => {
      const newMembers = space.members?.filter(m => m.userId === currentUserId) || [];
      return {
        ...space,
        invoices: [],
        members: newMembers,
        updatedAt: 'עודכן לפני רגע'
      };
    });
  };

  
// ==========================================
// SMART SHARES BALANCING ENGINE
// ==========================================
const calculateBalancedShares = (members: any[], settings: any) => {
  const activeMembers = members.filter(m => m.isActive !== false);
  const totalPeople = activeMembers.length + 1; // +1 for the creator
  
  let lockedPercentage = 0;
  let unlockedCount = 0;
  
  const isCreatorLocked = settings?.isCustomShare === true;
  const creatorLockedValue = settings?.mySharePercentage || 0;
  
  if (isCreatorLocked) {
    lockedPercentage += creatorLockedValue;
  } else {
    unlockedCount += 1;
  }
  
  activeMembers.forEach(m => {
    if (m.isCustomShare) {
      lockedPercentage += (m.sharePercentage || 0);
    } else {
      unlockedCount += 1;
    }
  });
  
  const remainingPercentage = Math.max(0, 100 - lockedPercentage);
  const defaultShare = unlockedCount > 0 ? (remainingPercentage / unlockedCount) : 0;
  
  const finalCreatorShare = isCreatorLocked ? creatorLockedValue : defaultShare;
  
  const finalMembers = members.map(m => {
    if (m.isActive === false) return { ...m, sharePercentage: 0 };
    if (m.isCustomShare) return m;
    return { ...m, sharePercentage: defaultShare };
  });
  
  return { finalMembers, finalCreatorShare, defaultShare };
};

const autoBalanceShares = (spaceId: string, performedBy: string) => {
    saveSpaceUpdate(spaceId, space => {
      const { finalMembers, finalCreatorShare, defaultShare } = calculateBalancedShares(space.members || [], space.settings);

      const newLog: AuditRecord = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        actionType: 'AUTO_BALANCE',
        performedBy,
        details: `המערכת חילקה את האחוזים הנותרים שווה בשווה (${defaultShare.toFixed(1)}% לכל חלק).`
      };

      return {
        ...space,
        settings: { ...space.settings, mySharePercentage: finalCreatorShare },
        members: finalMembers,
        auditLogs: [newLog, ...(space.auditLogs || [])]
      };
    });
  };


  const refreshMemberInvite = (spaceId: string, userId: string) => {
    saveSpaceUpdate(spaceId, space => {
      const updatedMembers = (space.members || []).map(m => {
        if (m.userId === userId && m.status === 'pending') {
          return { ...m, joinedAt: new Date().toISOString() };
        }
        return m;
      });
      return { ...space, members: updatedMembers };
    });
  };

  const removeMember = (spaceId: string, userId: string, performedBy: string, forceHardDelete: boolean = false) => {
    saveSpaceUpdate(spaceId, space => {
      const memberToRemove = space.members?.find(m => m.userId === userId);
      if (!memberToRemove) return space;

      let newMembers;
      let actionType: 'MEMBER_REMOVED' | 'MEMBER_LEFT' = 'MEMBER_REMOVED';
      let details = '';

      if (forceHardDelete) {
        newMembers = space.members?.filter(m => m.userId !== userId) || [];
        details = `השותף ${memberToRemove.name} נמחק לצמיתות.`;
      } else {
        newMembers = space.members?.map(m => m.userId === userId ? { ...m, isActive: false, sharePercentage: undefined } : m) || [];
        details = `השותף ${memberToRemove.name} סומן כלא-פעיל.`;
      }
      
      const newLog: AuditRecord = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        actionType,
        performedBy,
        details
      };
      
      const newSettings = { ...space.settings, mySharePercentage: undefined };

      return {
        ...space,
        settings: newSettings,
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
    <SpacesContext.Provider value={{ spaces, getRoleForSpace, addSpace, deleteSpace, restoreSpace, updateSpaceTitle, updateSpaceDate, updateSpaceCover, updateSpaceIcon, toggleFeature, updateSpaceSettings, updateInvoice, addInvoice, addMediaItem, updateMediaItem, removeMediaItem, likeMediaItem, joinSpace, finalizeGuestJoin,
      updateMemberPermissions, updateSharesBulk,
        updateMemberStatus,
        migrateGuestToRealUser,
      addComment,
      deleteComment,
      refreshMemberInvite,
      removeMember,
      restoreMember,
      autoBalanceShares,
      devResetSpace,
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

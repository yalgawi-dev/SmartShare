'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { AVAILABLE_FEATURES } from '../data/features';
import { isAuthenticPartnerName } from '../../utils/partnerUtils';
import { useAuth } from './AuthContext';
import { db } from '@/lib/firebase';
import { triggerPushNotification } from '@/utils/notifications';
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, addDoc, getDocs } from 'firebase/firestore';

export type FeatureId = string;
export type InvoiceStatus = 'approved' | 'pending' | 'dispute' | 'missing';


export interface InboxItem {
  id: string;
  imageUrl: string;
  status: 'processing' | 'ready' | 'irrelevant' | 'error' | 'duplicate' | 'pending';
  ocrData?: any;
  createdAt: string;
  uploadedBy: string;
  suggestedPayerId?: string;
}

export interface Invoice {
  isActive?: boolean;
  isStoreCredit?: boolean;
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
  approvedBy?: string[];
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


export interface DocumentShelf {
  id: string;
  name: string;
  allowedPartners: string[]; // empty means public
  createdAt: string;
  coverImage?: string;
  logoUrl?: string;
  icon?: string;
  highlightColor?: string;
}

export interface ShelfEventComment {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface ShelfEvent {
  id: string;
  shelfId: string;
  title: string;
  description: string;
  eventDate: string; // Contextual date
  createdAt: string;
  createdBy: string;
  documentIds: string[];
  comments: ShelfEventComment[];
  tasks?: { id: string; text: string; isCompleted: boolean; documentId?: string; completedAt?: string }[];
}

export interface SpaceDocument {
  id: string;
  shelfId: string;
  partitionName?: string;
  url: string;
  title: string;
  type: 'document' | 'image' | 'pdf';
  addedBy: string;
  createdAt: string;
  thumbnailUrl?: string;
  pages?: string[];
}

export interface SpaceSettings {
  isCustomShare?: boolean;
  customCategories?: string[];
  defaultVatRate: number;
  allowPartnersToEditWall: boolean;
  mySharePercentage?: number;
  showVaultTimeline?: boolean;
}

export interface SpaceMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  readBy: string[];
}

export interface SpaceConversation {
  id: string;
  type: 'group' | 'p2p';
  participants: string[];
  messages: SpaceMessage[];
}

export interface SpaceMember {
  messages?: any[];
  disputeResolved?: boolean;
  status?: any;
  disputeMessage?: string;
  userId: string;
  name: string; 
  canUpload: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canEditShares?: boolean;
  canAddPlugins?: boolean;
  canEditSettings?: boolean;
  canInvitePartners?: boolean;
  localAvatarUrl?: string; 
  useNickname?: boolean; 
  sharePercentage?: number;
  isActive?: boolean;
  welcomed?: boolean;
  joinedAt?: string;
  role?: 'creator' | 'admin' | 'partner';
  shareChangeRequest?: { proposedShare: number; creatorShare: number; timestamp: string; };

  extensionMessage?: string;
}


export interface AuditRecord {
  id: string;
  timestamp: string;
  actionType: 'MEMBER_LEFT' | 'MEMBER_REMOVED' | 'SHARES_UPDATED' | 'AUTO_BALANCE' | 'EDIT_INVOICE' | 'DELETE_INVOICE' | 'OTHER' | 'SYSTEM_ALERT';
  performedBy: string; // userId of who performed the action
  details: string; // Human readable explanation
  invoiceId?: string;
}

export interface PendingGroupMember {
  id: string; // userId or guest token
  name: string;
  phone?: string;
  avatarUrl?: string;
  requestedAt: string;
  inviterName?: string;
  inviterId?: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Space {
  creatorId?: string;
  createdBy?: string;
  createdAt?: string;
  pendingInvites?: any[];
  pendingGroupMembers?: PendingGroupMember[];
  conversations?: SpaceConversation[];
  inboxItems?: any[];
  inbox?: any[];
  id: string;
  title: string;
  description: string;
  icon: string;
  updatedAt: string;
  features: FeatureId[];
  settings: SpaceSettings;
  invoices: Invoice[];
  documents?: SpaceDocument[];
  shelves?: DocumentShelf[];
  shelfEvents?: ShelfEvent[];
  mediaItems: MediaItem[];
  members: SpaceMember[];
  auditLogs?: AuditRecord[];
  date?: string;
  coverImage?: string;
  logoUrl?: string;
  albumSize?: 'A3-landscape' | 'A4-landscape' | 'A4-portrait' | 'square';
  albumAtmospherePhotos?: string[];
  status?: 'active' | 'pending_deletion';
  deletionScheduledFor?: string;
}

interface SpacesContextType {
  requestGroupJoin: (spaceId: string, member: { id: string; name: string; phone?: string; avatarUrl?: string; inviterName?: string; inviterId?: string }) => Promise<void>;
  approveGroupMember: (spaceId: string, memberId: string) => Promise<void>;
  rejectGroupMember: (spaceId: string, memberId: string) => Promise<void>;
  approveAllGroupMembers: (spaceId: string) => Promise<void>;
  migrateGuestToRealUser: (spaceId: string, userId: string, realUid: string, realName: string) => void;

  setExtensionMessage?: any;
  sendConversationMessage?: any;
  markConversationRead?: any;
    personalInbox: any[];
    setPersonalInbox: React.Dispatch<React.SetStateAction<any[]>>;
  fetchPersonalInbox: () => Promise<void>;
  addToPersonalInbox: (item: any) => Promise<string>;
  removeFromPersonalInbox: (itemId: string) => Promise<void>;
  updatePersonalInboxItem: (itemId: string, updates: any) => Promise<void>;

  updateSharesBulk: (spaceId: string, myShare: number, partnerShares: Record<string, number>) => void;
  approveShareChange: (spaceId: string, userId: string) => void;
  rejectShareChange: (spaceId: string, userId: string) => void;
  approveExtension: (spaceId: string, memberId: string) => void;
  spaces: Space[];
  addSpace: (space: Omit<Space, 'id' | 'updatedAt' | 'settings' | 'invoices' | 'mediaItems' | 'date' | 'coverImage'>) => Promise<string>;
  deleteSpace: (spaceId: string) => void;
  permanentlyDeleteSpace: (spaceId: string) => Promise<void>;
  restoreSpace: (spaceId: string) => void;
  updateSpaceTitle: (spaceId: string, newTitle: string) => void;
  updateSpaceDate: (spaceId: string, newDate: string) => void;
  updateSpaceCover: (spaceId: string, newCoverUrl: string) => void;
  updateSpaceLogo: (spaceId: string, newLogoUrl: string) => void;
  updateSpaceIcon: (spaceId: string, newIcon: string) => void;
  toggleFeature: (spaceId: string, featureId: FeatureId, performedBy?: string) => void;
  updateSpaceSettings: (spaceId: string, newSettings: Partial<SpaceSettings>) => void;
  updateInvoice: (spaceId: string, invoiceId: string, updates: Partial<Invoice>, performedBy?: string, actionDetail?: string) => void;

  addInvoice: (spaceId: string, invoice: Omit<Invoice, 'id'>) => void;
  approveAndRouteInvoice: (spaceId: string, invoice: Omit<Invoice, 'id'>, inboxItemId: string) => Promise<boolean>;
  addInboxItems: (spaceId: string, items: Omit<InboxItem, 'id' | 'createdAt'>[]) => void;
  updateInboxItem: (spaceId: string, itemId: string, updates: Partial<InboxItem>) => void;
  removeInboxItem: (spaceId: string, itemId: string) => void;

  addMediaItem: (spaceId: string, item: Omit<MediaItem, 'id' | 'timestamp' | 'likes'>) => void;
  updateMediaItem: (spaceId: string, mediaId: string, updates: Partial<MediaItem>) => void;
  addDocument: (spaceId: string, doc: Omit<SpaceDocument, 'id' | 'createdAt'>) => string;
  addDocumentAndLinkToEvent: (spaceId: string, doc: Omit<SpaceDocument, 'id' | 'createdAt'>, eventId: string) => string;
  updateDocument: (spaceId: string, docId: string, updates: Partial<SpaceDocument>) => void;
  removeDocument: (spaceId: string, docId: string) => void;
  addShelf: (spaceId: string, shelf: Omit<DocumentShelf, 'id' | 'createdAt'>) => string;
  updateShelf: (spaceId: string, shelfId: string, updates: Partial<DocumentShelf>) => void;
  removeShelf: (spaceId: string, shelfId: string) => void;
  addShelfEvent: (spaceId: string, event: Omit<ShelfEvent, 'id' | 'createdAt' | 'createdBy' | 'comments'>) => void;
  updateShelfEvent: (spaceId: string, eventId: string, updates: Partial<ShelfEvent>) => void;
  removeShelfEvent: (spaceId: string, eventId: string) => void;
  addShelfEventComment: (spaceId: string, eventId: string, text: string) => void;
  removeShelfEventComment: (spaceId: string, eventId: string, commentId: string) => void;
  removeMediaItem: (spaceId: string, mediaId: string) => void;
  likeMediaItem: (spaceId: string, mediaId: string) => void;
  addComment: (spaceId: string, mediaId: string, comment: Omit<Comment, 'id' | 'timestamp'>) => void;
  deleteComment: (spaceId: string, mediaId: string, commentId: string) => void;
  updateMemberPermissions: (spaceId: string, userId: string, permissions: Partial<SpaceMember>) => void;
  updateMemberStatus: (spaceId: string, userId: string, status: 'active' | 'pending' | 'disputed', message?: string) => void;
  updateMemberRole: (spaceId: string, userId: string, role: 'admin' | 'partner') => void;
  removeMember: (spaceId: string, userId: string, performedBy: string, forceHardDelete?: boolean) => void;
  autoBalanceShares: (spaceId: string, performedBy: string) => void;
  devResetSpace: (spaceId: string, currentUserId: string) => void;
  addAuditLog: (spaceId: string, log: Omit<AuditRecord, 'id' | 'timestamp'>) => void;
  joinSpace: (spaceId: string, userId: string, name: string) => void;
  getRoleForSpace: (spaceId: string) => 'creator' | 'partner' | 'none';
  getTokenForSpace: (spaceId: string) => string | null;
  finalizeGuestJoin: (
    spaceId: string, 
    name: string, 
    isRetroactive: boolean, 
    userId: string, 
    inviteToken?: string,
    customShare?: number,
    sharesPlan?: { creator: number; partners?: Record<string, number> }
  ) => void;
  declinePendingInvite: (spaceId: string, token: string) => void;
  createPendingInvite: (spaceId: string, inviteData: {
    token: string;
    name?: string;
    isRetroactive: boolean;
    guestShare: number;
    creatorShare: number;
    partnerShares?: Record<string, number>;
    targetUserId?: string;
  }) => void;
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
    title: 'גולדה',
    description: 'מרחב מבוסס על תבנית ניהול הוצאות / התחשבנויות',
    icon: '💰',
    updatedAt: '\u05e2\u05d5\u05d3\u05db\u05df \u05e2\u05db\u05e9\u05d9\u05d5',
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
  const spacesBaseRef = useRef<Omit<Space, 'mediaItems'>[]>([]);
  // Keep ref strictly synced during renders for outside reads if needed
  spacesBaseRef.current = spacesBase;
  const [mediaItemsBySpace, setMediaItemsBySpace] = useState<Record<string, MediaItem[]>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [personalInbox, setPersonalInbox] = useState<any[]>([]);
  const mediaUnsubscribes = useRef<Record<string, () => void>>({});

  const getTokenForSpace = (spaceId: string): string | null => {
    if (user && user.spaceKeys && user.spaceKeys[spaceId]) {
      return user.spaceKeys[spaceId].token || null;
    }
    if (typeof window !== 'undefined') {
      try {
        const localKeys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
        if (localKeys[spaceId]) return localKeys[spaceId].token || null;
      } catch(e) {}
    }
    return null;
  };

  const getRoleForSpace = (spaceId: string): 'creator' | 'partner' | 'none' => {
    // 1. Check Auth Context (Single Source of Truth in Firestore)
    if (user && user.spaceKeys && user.spaceKeys[spaceId]) {
      return user.spaceKeys[spaceId].role;
    }
    // 2. Check Local Storage (Fallback for pre-sync / anonymous users)
    if (typeof window !== 'undefined') {
      try {
        const localKeys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
        if (localKeys[spaceId]) return localKeys[spaceId].role;
      } catch(e) {}
    }
    
    // 3. Strict DB entity matching by unique ID only
    const space = spacesBase.find(s => s.id === spaceId);
    if (space) {
      if (user?.id && space.creatorId && user.id === space.creatorId) {
        return 'creator';
      }
      if (user?.id && space.members?.some((m: any) => m.userId === user.id)) {
        return 'partner';
      }
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

        let needsDbHealing = false;
        const rawPendingInvites = (data.pendingInvites || []).map((inv: any) => {
          if (inv && inv.name && !isAuthenticPartnerName(inv.name)) {
            needsDbHealing = true;
            return { ...inv, name: 'שותף מוזמן' };
          }
          return inv;
        });

        // Deduplicate pending invites so a partner isn't invited multiple times
        const dedupedPendingInvites: any[] = [];
        const seenInviteKeys = new Set<string>();
        // Process in reverse so the latest invite is kept
        for (let i = rawPendingInvites.length - 1; i >= 0; i--) {
          const inv = rawPendingInvites[i];
          if (!inv) continue;
          const key = inv.targetUserId 
            ? `uid_${inv.targetUserId}` 
            : (inv.name && inv.name.trim() && inv.name.trim() !== 'שותף מוזמן' ? `name_${inv.name.trim().toLowerCase()}` : `token_${inv.token}`);
          
          if (!seenInviteKeys.has(key)) {
            seenInviteKeys.add(key);
            dedupedPendingInvites.unshift(inv);
          } else {
            needsDbHealing = true;
          }
        }
        const healedPendingInvites = dedupedPendingInvites;

        const healedMembers = (data.members || []).map((m: any) => {
          if (m && m.name && !isAuthenticPartnerName(m.name)) {
            needsDbHealing = true;
            return { ...m, name: m.role === 'creator' ? (data.createdBy || 'מנהל') : 'שותף מוזמן' };
          }
          return m;
        });

        if (needsDbHealing) {
          updateDoc(doc.ref, {
            pendingInvites: healedPendingInvites,
            members: healedMembers
          }).catch(console.error);
        }

        return { 
          id: doc.id, 
          ...data,
          pendingInvites: healedPendingInvites,
          members: healedMembers
        } as Omit<Space, 'mediaItems'>;
      }).filter(s => {
        // Auto-purge expired spaces in pending_deletion whose expiration date has passed
        if (s.status === 'pending_deletion' && s.deletionScheduledFor) {
          const expireTime = new Date(s.deletionScheduledFor).getTime();
          if (!isNaN(expireTime) && expireTime <= Date.now()) {
            deleteDoc(doc(db, 'spaces', s.id)).catch(console.error);
            return false;
          }
        }
        return true;
      });

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
       try {
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
       } catch (e) {}
       setIsLoaded(true);
    });

    return () => {
      unsubscribeSpaces();
      Object.values(mediaUnsubscribes.current).forEach(unsub => unsub());
    };
  }, []);

  // Auto-sync authentic user name to spaces
  useEffect(() => {
    if (!user?.id || !user?.realName || user.realName === 'אורח' || user.realName === 'אורח אנונימי' || spacesBase.length === 0) return;
    
    // Find spaces where we are a member but our name doesn't match our authenticated realName
    spacesBase.forEach(space => {
      const myMember = space.members?.find((m: any) => m.userId === user.id);
      if (myMember && myMember.name !== user.realName) {
        const updatedMembers = space.members!.map((m: any) => 
          m.userId === user.id ? { ...m, name: user.realName! } : m
        );
        updateDoc(doc(db, 'spaces', space.id), { members: updatedMembers }).catch(console.error);
      }
    });
  }, [user?.id, user?.realName, spacesBase]);

  // Compute final spaces array for context consumers
  const spaces: Space[] = spacesBase.map(base => ({
    ...base,
    mediaItems: mediaItemsBySpace[base.id] || []
  }));

  const sanitizeForFirestore = (obj: any): any => {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
    const res: any = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) {
        res[key] = sanitizeForFirestore(obj[key]);
      }
    }
    return res;
  };

  // Helper function to update Space ROOT document
    const saveSpaceUpdate = async (spaceId: string, mutator: (space: Omit<Space, 'mediaItems'>) => Omit<Space, 'mediaItems'>): Promise<boolean> => {
      // 1. Get current space and compute mutation synchronously using REF
      const currentSpace = spacesBaseRef.current.find(s => s.id === spaceId);
      if (!currentSpace) return false;
      
      const updatedSpace = mutator(currentSpace);
      if (updatedSpace === currentSpace) return false;
      
      // 2. Optimistically update REF and UI immediately
      const nextSpaces = spacesBaseRef.current.map(space => space.id === spaceId ? updatedSpace : space);
      spacesBaseRef.current = nextSpaces; // Sync immediately
      setSpacesBase(nextSpaces);
  
      // 3. Save to Firestore
      try {
        await setDoc(doc(db, 'spaces', spaceId), sanitizeForFirestore(updatedSpace));
        return true;
      } catch (e: any) {
        console.error("Error updating Firestore space root", e);
        // Revert UI on failure
        const revertedSpaces = spacesBaseRef.current.map(space => space.id === spaceId ? currentSpace : space);
        spacesBaseRef.current = revertedSpaces;
        setSpacesBase(revertedSpaces);
        return false;
      }
    };

  
    // Fix identity mismatch when user logs in and spaces are loaded
  useEffect(() => {
    if (!user || !user.id || spacesBase.length === 0) return;
    let localKeys: any = {};
    if (typeof window !== 'undefined') {
      try {
        const parsed = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
        localKeys = parsed || {};
      } catch (e) {}
    }
    
    spacesBase.forEach(space => {
      const localRole = localKeys?.[space.id]?.role;
      const cloudRole = user.spaceKeys?.[space.id]?.role;
      const isCreatorByRole = localRole === 'creator' || cloudRole === 'creator';
      
      let needsUpdate = false;
      let updates: any = {};
      
      if (isCreatorByRole) {
        if (!space.creatorId) {
          updates.creatorId = user.id;
          updates.createdBy = user.realName || user.nickname || 'יוצר המרחב';
          needsUpdate = true;
        }
        if (space.members?.some((m: any) => m.userId === user.id)) {
          updates.members = space.members.filter((m: any) => m.userId !== user.id);
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        updateDoc(doc(db, 'spaces', space.id), updates).catch(console.error);
      }
    });
  }, [user, spacesBase]);

  
  useEffect(() => {
    if (user?.id) fetchPersonalInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchPersonalInbox = async () => {
    if (!user || !user.id) return;
    try {
      const q = collection(db, 'users', user.id, 'personal_inbox');
      const snap = await getDocs(q);
      const items = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      setPersonalInbox(items.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.error('Error fetching personal inbox', e);
    }
  };

  const addToPersonalInbox = async (item: any) => {
    if (!user || !user.id) {
      const guestItem = {
        id: 'local_' + Date.now() + '_' + Math.random().toString(36).substring(7),
        ...item,
        createdAt: new Date().toISOString()
      };
      setPersonalInbox(prev => [guestItem, ...prev]);
      try {
        const stored = JSON.parse(localStorage.getItem('smartshare_personal_inbox_local') || '[]');
        localStorage.setItem('smartshare_personal_inbox_local', JSON.stringify([guestItem, ...stored]));
      } catch (err) {}
      return guestItem.id;
    }
    const docRef = await addDoc(collection(db, 'users', user.id, 'personal_inbox'), {
      ...item,
      createdAt: new Date().toISOString()
    });
    const newItem = { id: docRef.id, ...item, createdAt: new Date().toISOString() };
    setPersonalInbox(prev => [newItem, ...prev]);
    return docRef.id;
  };

  const removeFromPersonalInbox = async (itemId: string) => {
    const item = personalInbox.find(i => i.id === itemId);
    if (item?.imageUrl) {
      import('../../lib/firebase').then(({ deleteImageFromStorage }) => {
        deleteImageFromStorage(item.imageUrl);
      }).catch(console.error);
    }
    if (!user || !user.id) return;
    await deleteDoc(doc(db, 'users', user.id, 'personal_inbox', itemId));
    setPersonalInbox(prev => prev.filter(i => i.id !== itemId));
  };

  const updatePersonalInboxItem = async (itemId: string, updates: any) => {
    if (!user || !user.id) return;
    await updateDoc(doc(db, 'users', user.id, 'personal_inbox', itemId), updates);
    setPersonalInbox(prev => prev.map(i => i.id === itemId ? { ...i, ...updates } : i));
  };

  const addSpace = async (spaceData: Omit<Space, 'id' | 'updatedAt' | 'settings' | 'invoices' | 'mediaItems' | 'date' | 'coverImage'>): Promise<string> => {
    const masterKey = 'master_' + crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const newSpace: Omit<Space, 'mediaItems'> = {
      ...spaceData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      date: new Date().toLocaleDateString('he-IL'),
      updatedAt: '\u05e2\u05d5\u05d3\u05db\u05df \u05e2\u05db\u05e9\u05d9\u05d5',
      settings: defaultSettings,
      invoices: [],
      members: [],
      /* masterKey: masterKey, */
      creatorId: user?.id || undefined,
      createdBy: user?.realName || user?.nickname || 'יוצר המרחב'
    };
    
    // 1. Save to LocalStorage keyring (for guests / robust fallback)
    try {
      const localKeys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
      localKeys[newSpace.id] = { role: 'creator', token: masterKey };
      localStorage.setItem('smartshare_keys', JSON.stringify(localKeys));
    } catch(e) {}
    
    // 2. Save Space to DB
    setSpacesBase(prev => [newSpace, ...prev]);
    await setDoc(doc(db, 'spaces', newSpace.id), sanitizeForFirestore(newSpace));
    
    // 3. Dispatch an event so AuthContext can sync it to the User Profile
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smartshare_new_key', { detail: { spaceId: newSpace.id, role: 'creator', token: masterKey } }));
    }
    
    return newSpace.id;
  };

  const deleteSpace = async (spaceId: string) => {
    const spaceToDel = spacesBase.find(s => s.id === spaceId);
    if (!spaceToDel) return;

    const doSoftDelete = async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);
      try {
        await updateDoc(doc(db, 'spaces', spaceId), {
          status: 'pending_deletion',
          deletionScheduledFor: futureDate.toISOString()
        });
        // Update local state ONLY on success
        setSpacesBase(prev => prev.map(s => s.id === spaceId ? { 
          ...s, 
          status: 'pending_deletion', 
          deletionScheduledFor: futureDate.toISOString() 
        } : s));
      } catch (e: any) {
        console.error("Soft delete failed", e);
        alert("שגיאה במחיקת המרחב (ייתכן שאין לך הרשאות מחיקה): " + (e.message || ""));
      }
    };

    if (!spaceToDel.invoices || spaceToDel.invoices.length === 0) {
      try {
        await deleteDoc(doc(db, 'spaces', spaceId));
        setSpacesBase(prev => prev.filter(s => s.id !== spaceId));
      } catch (e) {
        console.warn("Hard delete failed, falling back to soft delete", e);
        await doSoftDelete();
      }
    } else {
      await doSoftDelete();
    }
  };

  const permanentlyDeleteSpace = async (spaceId: string) => {
    try {
      await deleteDoc(doc(db, 'spaces', spaceId));
      setSpacesBase(prev => prev.filter(s => s.id !== spaceId));
    } catch (e: any) {
      console.error("Permanent delete failed", e);
      alert("שגיאה במחיקת המרחב לצמיתות: " + (e.message || ""));
      throw e;
    }
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
      const currentFeatures = space.features || [];
      const hasFeature = currentFeatures.includes(featureId);
      const isRemoving = hasFeature;
      const newFeatures = isRemoving ? currentFeatures.filter((f: string) => f !== featureId) : [...currentFeatures, featureId];
      
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
    saveSpaceUpdate(spaceId, space => ({ ...space, title: newTitle, updatedAt: '\u05e2\u05d5\u05d3\u05db\u05df \u05e2\u05db\u05e9\u05d9\u05d5' }));
  };

  const updateSpaceDate = (spaceId: string, newDate: string) => {
    saveSpaceUpdate(spaceId, space => ({ ...space, date: newDate, updatedAt: '\u05e2\u05d5\u05d3\u05db\u05df \u05e2\u05db\u05e9\u05d9\u05d5' }));
  };

    const updateSpaceLogo = (spaceId: string, newLogoUrl: string) => {
    saveSpaceUpdate(spaceId, space => ({ ...space, logoUrl: newLogoUrl, updatedAt: 'עודכן עכשיו' }));
  };

  const updateSpaceCover = (spaceId: string, newCoverUrl: string) => {
    saveSpaceUpdate(spaceId, space => ({ ...space, coverImage: newCoverUrl, updatedAt: '\u05e2\u05d5\u05d3\u05db\u05df \u05e2\u05db\u05e9\u05d9\u05d5' }));
  };

  const updateSpaceIcon = (spaceId: string, newIcon: string) => {
    saveSpaceUpdate(spaceId, space => ({ ...space, icon: newIcon, updatedAt: '\u05e2\u05d5\u05d3\u05db\u05df \u05e2\u05db\u05e9\u05d9\u05d5' }));
  };

  const updateSpaceSettings = (spaceId: string, newSettings: Partial<SpaceSettings>) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      settings: { ...space.settings, ...newSettings },
      updatedAt: '\u05e2\u05d5\u05d3\u05db\u05df \u05e2\u05db\u05e9\u05d9\u05d5'
    }));
  };

  const updateInvoice = (spaceId: string, invoiceId: string, updates: Partial<Invoice>, performedBy?: string, actionDetail?: string, chatMessage?: { targetMemberId: string, text: string, from: 'creator'|'partner' }) => {
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
          actionType: (isDelete ? "DELETE_INVOICE" : "EDIT_INVOICE") as any,
          performedBy,
          details: `${performer} ${actionLabel}${amt} מאת "${supplier}". פירוט: ${actionDetail}`,
          invoiceId
        };
        newSpace.auditLogs = [newLog, ...(space.auditLogs || [])];
      }

      if (chatMessage) {
        newSpace.members = (newSpace.members || []).map(m => {
          if (m.userId !== chatMessage.targetMemberId) return m;
          const newMsg = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
            text: chatMessage.text.trim(),
            from: chatMessage.from,
            createdAt: new Date().toISOString(),
            readAt: undefined
          };
          return { ...m, messages: [...(m.messages || []), newMsg] };
        });
      }

      return newSpace;
    });
  };

const joinSpace = (spaceId: string, userId: string, name: string) => {
    saveSpaceUpdate(spaceId, space => {
      if (space.members?.some(m => m.userId === userId)) return space; 
      return {
        ...space,
        members: [...(space.members || []), {
          userId,
          name,
          role: 'partner' as const,
          status: 'active' as const,
          isActive: true,
          canUpload: true,
          canDelete: false,
          canEdit: false,
          joinedAt: new Date().toISOString()
        } as any]
      };
    });
  };

    // Presence heartbeat
    useEffect(() => {
      if (!user?.id || (user as any).isAnonymous) return;
      
      let lastActivityTime = Date.now();
      const onUserActivity = () => { lastActivityTime = Date.now(); };
      
      if (typeof window !== 'undefined') {
        window.addEventListener('touchstart', onUserActivity, { passive: true });
        window.addEventListener('mousemove', onUserActivity, { passive: true });
        window.addEventListener('keydown', onUserActivity, { passive: true });
        window.addEventListener('scroll', onUserActivity, { passive: true });
      }

      const updatePresence = () => {
        if (!db || !user?.id) return;
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
        
        // Stop sending heartbeat if completely idle for 4 minutes
        if (Date.now() - lastActivityTime > 4 * 60 * 1000) return;
        
        const userRef = doc(db, 'users', user.id);
        updateDoc(userRef, { lastActiveAt: new Date().toISOString() }).catch(() => {});
      };
      
      updatePresence();
      const interval = setInterval(updatePresence, 2 * 60 * 1000);
      
      return () => { 
        clearInterval(interval); 
        if (typeof window !== 'undefined') {
          window.removeEventListener('touchstart', onUserActivity);
          window.removeEventListener('mousemove', onUserActivity);
          window.removeEventListener('keydown', onUserActivity);
          window.removeEventListener('scroll', onUserActivity);
        }
      };
    }, [user?.id]);

  const finalizeGuestJoin = (spaceId: string, name: string, isRetroactiveParam: boolean, userId: string, inviteToken?: string, customShareParam?: number, sharesPlanParam?: { creator: number; partners?: Record<string, number> }) => {
    saveSpaceUpdate(spaceId, space => {
      const pendingInvite = inviteToken ? (space.pendingInvites || []).find(i => i.token === inviteToken) : undefined;
      
      let customShare = pendingInvite ? pendingInvite.guestShare : customShareParam;
      let sharesPlan = pendingInvite ? { creator: pendingInvite.creatorShare, partners: pendingInvite.partnerShares || undefined } : sharesPlanParam;
      let isRetroactive = pendingInvite ? pendingInvite.isRetroactive : isRetroactiveParam;

      const hasCustomShare = customShare !== undefined && customShare !== null && !isNaN(customShare);
      const existingMember = (space.members || []).find(m => m.userId === userId);
      
      const newMember = {
        userId: userId,
        name: name.trim() || pendingInvite?.name || existingMember?.name || 'שותף מוזמן',
        role: 'partner' as const,
        joinedAt: existingMember?.joinedAt || new Date().toISOString(),
        isActive: true,
        canUpload: true,
        canEdit: false,
        canDelete: false,
        status: 'active' as const,
        welcomed: true,
        sharePercentage: hasCustomShare ? customShare : (existingMember?.sharePercentage ?? 0),
        isCustomShare: true
      };
      
      let updatedInvoices = space.invoices || [];
      if (!isRetroactive) {
        updatedInvoices = updatedInvoices.map(inv => ({
          ...inv,
          excludedMembers: [...(inv.excludedMembers || []), userId]
        }));
      }

      let finalMembersList: any[];
      let finalCreatorShare: number;
      const existingMembersWithoutThis = (space.members || []).filter(m => m.userId !== userId);

      if (sharesPlan) {
        finalCreatorShare = sharesPlan.creator;
        finalMembersList = existingMembersWithoutThis.map(m => {
          if (sharesPlan.partners && sharesPlan.partners[m.userId] !== undefined) {
            return { ...m, sharePercentage: sharesPlan.partners[m.userId], isCustomShare: true };
          }
          return m;
        });
        finalMembersList.push(newMember);

        const totalPartners = finalMembersList.reduce((acc, m) => acc + (m.isActive !== false && typeof m.sharePercentage === 'number' ? m.sharePercentage : 0), 0);
        if (Math.abs(finalCreatorShare + totalPartners - 100) > 0.01) {
          finalCreatorShare = Math.max(0, 100 - totalPartners);
        }
      } else {
        const newMembersList = [...existingMembersWithoutThis, newMember];
        const { finalMembers, finalCreatorShare: calculatedCreatorShare } = calculateBalancedShares(newMembersList, space.settings);
        finalMembersList = finalMembers;
        finalCreatorShare = calculatedCreatorShare;
      }
      
      const newPendingInvites = (space.pendingInvites || []).filter(i => 
        i.token !== userId && 
        i.token !== inviteToken && 
        (!i.targetUserId || i.targetUserId !== userId) &&
        (!i.name || !newMember.name || i.name.trim() !== newMember.name.trim())
      );

      return {
        ...space,
        pendingInvites: newPendingInvites,
        members: finalMembersList,
        settings: { ...space.settings, mySharePercentage: finalCreatorShare, isCustomShare: true },
        invoices: updatedInvoices
      };
    });
  };

  const declinePendingInvite = (spaceId: string, token: string) => {
    saveSpaceUpdate(spaceId, space => {
      const pendingInvites = (space.pendingInvites || []).filter((inv: any) => inv.token !== token);
      return { ...space, pendingInvites };
    });
  };

  const createPendingInvite = (spaceId: string, inviteData: {
    token: string;
    name?: string;
    isRetroactive: boolean;
    guestShare: number;
    creatorShare: number;
    partnerShares?: Record<string, number>;
    targetUserId?: string;
  }) => {
    saveSpaceUpdate(spaceId, space => {
      const newInvite = {
        token: inviteData.token,
        name: inviteData.name?.trim() || 'שותף מוזמן',
        guestShare: inviteData.guestShare,
        creatorShare: inviteData.creatorShare,
        partnerShares: inviteData.partnerShares || null,
        isRetroactive: inviteData.isRetroactive,
          createdAt: new Date().toISOString(),
          targetUserId: inviteData.targetUserId
      };

      // Avoid duplicate pending invites for the same targetUserId, identical name, or duplicate anonymous/default invites
      const existingInvites = (space.pendingInvites || []).filter((inv: any) => {
        if (inviteData.targetUserId && inv.targetUserId === inviteData.targetUserId) return false;
        if (inviteData.name && inviteData.name.trim() && inv.name && inv.name.trim().toLowerCase() === inviteData.name.trim().toLowerCase()) return false;
        if (!inviteData.name?.trim() && (!inv.name || inv.name.trim() === 'שותף מוזמן')) return false;
        return true;
      });

      return {
        ...space,
        pendingInvites: [...existingInvites, newInvite]
      };
    });
  };

  
  const requestGroupJoin = async (spaceId: string, member: { id: string; name: string; phone?: string; avatarUrl?: string; inviterName?: string; inviterId?: string }) => {
    saveSpaceUpdate(spaceId, space => {
      const existingPending = space.pendingGroupMembers || [];
      if (existingPending.some(p => p.id === member.id)) {
        return space;
      }
      const newPending: PendingGroupMember = {
        id: member.id,
        name: member.name,
        phone: member.phone,
        avatarUrl: member.avatarUrl,
        requestedAt: new Date().toISOString(),
        inviterName: member.inviterName,
        inviterId: member.inviterId,
        status: 'pending'
      };

      // Notify space creator / admin via push notification
      const adminId = space.creatorId || space.createdBy;
      if (adminId) {
        triggerPushNotification(
          [adminId],
          `בקשת הצטרפות למרחב "${space.title}"`,
          `${member.name} מבקש/ת להצטרף למרחב דרך קישור קבוצתי. אשר את כניסתו/ה.`
        );
      }

      return {
        ...space,
        pendingGroupMembers: [...existingPending, newPending]
      };
    });
  };

  const approveGroupMember = async (spaceId: string, memberId: string) => {
    saveSpaceUpdate(spaceId, space => {
      const pendingList = space.pendingGroupMembers || [];
      const pendingMember = pendingList.find(p => p.id === memberId);
      if (!pendingMember) return space;

      const remainingPending = pendingList.filter(p => p.id !== memberId);
      const existingMembers = space.members || [];
      const alreadyMember = existingMembers.find(m => m.userId === memberId);

      let finalMembersList: SpaceMember[];
      if (alreadyMember) {
        finalMembersList = existingMembers.map(m => m.userId === memberId ? { ...m, isActive: true, status: 'active' as const, welcomed: true } : m);
      } else {
        const newMember: SpaceMember = {
          userId: memberId,
          name: pendingMember.name,
          role: 'partner',
          joinedAt: new Date().toISOString(),
          isActive: true,
          canUpload: true,
          canEdit: false,
          canDelete: false,
          status: 'active' as const,
          welcomed: true,
          sharePercentage: 0,
          localAvatarUrl: pendingMember.avatarUrl
        };
        finalMembersList = [...existingMembers, newMember];
      }

      // Notify approved member and all active space members
      const allRecipientIds = [memberId, ...existingMembers.map(m => m.userId), space.creatorId || ''].filter(Boolean);
      triggerPushNotification(
        allRecipientIds,
        `הצטרפות אושרה במרחב "${space.title}"`,
        `${pendingMember.name} אושר/ה והצטרף/ה בהצלחה למרחב!`
      );

      return {
        ...space,
        pendingGroupMembers: remainingPending,
        members: finalMembersList
      };
    });
  };

  const rejectGroupMember = async (spaceId: string, memberId: string) => {
    saveSpaceUpdate(spaceId, space => {
      const pendingList = space.pendingGroupMembers || [];
      return {
        ...space,
        pendingGroupMembers: pendingList.filter(p => p.id !== memberId)
      };
    });
  };

  const approveAllGroupMembers = async (spaceId: string) => {
    saveSpaceUpdate(spaceId, space => {
      const pendingList = space.pendingGroupMembers || [];
      if (pendingList.length === 0) return space;

      const existingMembers = [...(space.members || [])];
      pendingList.forEach(pending => {
        const idx = existingMembers.findIndex(m => m.userId === pending.id);
        if (idx >= 0) {
          existingMembers[idx] = { ...existingMembers[idx], isActive: true, status: 'active' as const, welcomed: true };
        } else {
          existingMembers.push({
            userId: pending.id,
            name: pending.name,
            role: 'partner',
            joinedAt: new Date().toISOString(),
            isActive: true,
            canUpload: true,
            canEdit: false,
            canDelete: false,
            status: 'active' as const,
            welcomed: true,
            sharePercentage: 0,
            localAvatarUrl: pending.avatarUrl
          });
        }
      });

      const allRecipientIds = [...existingMembers.map(m => m.userId), space.creatorId || ''].filter(Boolean);
      triggerPushNotification(
        allRecipientIds,
        `חברים חדשים אושרו במרחב "${space.title}"`,
        `${pendingList.length} משתתפים חדשים אושרו והצטרפו למרחב!`
      );

      return {
        ...space,
        pendingGroupMembers: [],
        members: existingMembers
      };
    });
  };

  const updateMemberRole = (spaceId: string, userId: string, role: 'admin' | 'partner') => {

    saveSpaceUpdate(spaceId, space => ({
      ...space,
      members: (space.members || []).map(m => m.userId === userId ? { ...m, role } : m)
    }));
  };

  const updateMemberStatus = (spaceId: string, userId: string, status: 'active' | 'pending' | 'disputed', message?: string) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      members: (space.members || []).map(m => {
        if (m.userId === userId) {
          const isResolving = m.status === 'disputed' && status === 'pending';
          return { 
            ...m, 
            status, 
            disputeMessage: message || m.disputeMessage,
            disputeResolved: isResolving ? true : m.disputeResolved
          };
        }
        return m;
      })
    }));
  };

  const migrateGuestToRealUser = (spaceId: string, userId: string, realUid: string, realName: string) => {
    saveSpaceUpdate(spaceId, space => {
      // Replace member token with real ID and set to active
      const updatedMembers = (space.members || []).map(m => 
        m.userId === userId ? { ...m, userId: realUid, name: realName, status: 'active' as const, disputeMessage: '' } : m
      );
      
      // Update any invoices that had the shadow token in excludedMembers
      const updatedInvoices = (space.invoices || []).map(inv => ({
        ...inv,
        excludedMembers: (inv.excludedMembers || []).map(id => id === userId ? realUid : id)
      }));
      
      return { ...space, members: updatedMembers as any, invoices: updatedInvoices };
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smartshare_new_key', { 
        detail: { spaceId, role: 'partner', token: realUid } 
      }));
    }
  };

  
  const approveShareChange = (spaceId: string, userId: string) => {
    saveSpaceUpdate(spaceId, space => {
      const member = (space.members || []).find(m => m.userId === userId);
      if (!member || !member.shareChangeRequest) return space;
      
      const { proposedShare, creatorShare } = member.shareChangeRequest;
      const newMembers = (space.members || []).map(m => {
        if (m.userId === userId) {
          const mCopy = { ...m, sharePercentage: proposedShare };
          delete mCopy.shareChangeRequest;
          return mCopy;
        }
        return m;
      });
      return {
        ...space,
        members: newMembers,
        settings: {
          ...space.settings,
          mySharePercentage: creatorShare,
          isCustomShare: true
        }
      };
    });
  };

  const rejectShareChange = (spaceId: string, userId: string) => {
    saveSpaceUpdate(spaceId, space => {
      const newMembers = (space.members || []).map(m => {
        if (m.userId === userId && m.shareChangeRequest) {
          const mCopy = { ...m };
          delete mCopy.shareChangeRequest;
          return mCopy;
        }
        return m;
      });
      return {
        ...space,
        members: newMembers
      };
    });
  };

  const updateSharesBulk = (spaceId: string, myShare: number, partnerShares: Record<string, number>) => {
    saveSpaceUpdate(spaceId, space => {
      let requiresApproval = false;
      const newMembers = (space.members || []).map(m => {
        if (partnerShares[m.userId] !== undefined) {
          const newShare = partnerShares[m.userId];
          if (m.status === 'active' && m.sharePercentage !== newShare) {
            requiresApproval = true;
            return {
              ...m,
              shareChangeRequest: {
                proposedShare: newShare,
                creatorShare: myShare,
                timestamp: new Date().toISOString()
              }
            };
          } else {
            let newStatus = m.status;
            let newJoinedAt = m.joinedAt;
            let isResolving = false;
            if (m.status === 'disputed') {
              newStatus = 'pending';
              newJoinedAt = new Date().toISOString(); // Reset timer
              isResolving = true;
            }
            return { 
              ...m, 
              sharePercentage: newShare, 
              isCustomShare: true,
              status: newStatus,
              joinedAt: newJoinedAt,
              disputeResolved: isResolving ? true : m.disputeResolved
            };
          }
        }
        return m;
      });
      return {
        ...space,
        members: newMembers,
        settings: { 
          ...space.settings, 
          mySharePercentage: requiresApproval ? space.settings?.mySharePercentage : myShare, 
          isCustomShare: true 
        }
      };
    });
  };

const updateMemberPermissions = (spaceId: string, userId: string, permissions: Partial<SpaceMember>) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      members: (space.members || []).map(m => m.userId === userId ? { ...m, ...permissions } : m)
    }));
  };

  // Operational Messages (2-way private creator - partner)
    const sendConversationMessage = (spaceId: string, conversationId: string, senderId: string, text: string) => {
    saveSpaceUpdate(spaceId, space => {
      const convos = space.conversations || [];
      let convo = convos.find(c => c.id === conversationId);
      if (!convo) {
        const participants = conversationId === 'group' ? ['group'] : conversationId.split('_');
        convo = { id: conversationId, type: conversationId === 'group' ? 'group' : 'p2p', participants, messages: [] };
        convos.push(convo);
      }
      const newMsg = { id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2,5), senderId, text: text.trim(), createdAt: new Date().toISOString(), readBy: [senderId] };
      const updatedConvos = [...convos.filter(c => c.id !== conversationId), { ...convo, messages: [...convo.messages, newMsg] }];
      
      setTimeout(() => {
        const title = conversationId === 'group' ? "הודעה חדשה בקבוצה: " + (space.title || 'מרחב') : "הודעה חדשה בפרטי: " + (space.title || 'מרחב');
        const senderName = senderId === space.creatorId ? (space.createdBy || 'מנהל') : (space.members?.find((m: any) => m.userId === senderId)?.name || 'שותף');
        const body = senderName + ": " + text.trim();
        let otherUserIds: string[] = [];
        if (conversationId === 'group') {
          otherUserIds = [space.creatorId, ...(space.members || []).map((m: any) => m.userId)].filter(id => id && id !== senderId);
        } else {
          otherUserIds = conversationId.split('_').filter(id => id && id !== senderId);
        }
        triggerPushNotification(otherUserIds, title, body, { url: '/space/' + spaceId, tag: 'chat-' + spaceId + '-' + conversationId });
      }, 0);

      return { ...space, conversations: updatedConvos };
    });
  };

  const markConversationRead = (spaceId: string, conversationId: string, readerId: string, alternateReaderId?: string) => {
    if (!spaceId || !conversationId || !readerId) return;
    saveSpaceUpdate(spaceId, space => {
      const convos = space.conversations || [];
      const readers = [readerId, alternateReaderId].filter(Boolean) as string[];
      if (readers.length === 0) return space;

      let convosChanged = false;
      const updatedConvos = convos.map(c => {
        if (c.id !== conversationId) return c;
        let messagesChanged = false;
        const newMessages = (c.messages || []).map(msg => {
          // Rule: Never mark author's own sent message with their own reader ID as "read by recipient"
          const anyMsg = msg as any;
          const isMsgFromCurrentReader = readers.includes(msg.senderId) || 
            (readerId === space.creatorId && (msg.senderId === space.createdBy || msg.senderId === 'me' || anyMsg.from === 'creator'));
          if (isMsgFromCurrentReader) {
            return msg;
          }
          const missing = readers.filter(r => !msg.readBy || !msg.readBy.includes(r));
          if (missing.length > 0) {
            messagesChanged = true;
            return { ...msg, readBy: [...(msg.readBy || []), ...missing] };
          }
          return msg;
        });
        if (messagesChanged) {
          convosChanged = true;
          return { ...c, messages: newMessages };
        }
        return c;
      });
      
      let updatedMembers = space.members;
      let membersChanged = false;
      if (conversationId !== 'group' && space.members) {
        const isCreator = Boolean(space.creatorId && readerId === space.creatorId);
        const otherUserId = conversationId.split('_').find(id => id !== readerId && id !== alternateReaderId);
        if (otherUserId) {
          updatedMembers = space.members.map(m => {
            const targetMemberId = isCreator ? otherUserId : readerId;
            if (m.userId !== targetMemberId && m.userId !== alternateReaderId) return m;
            
            if (!m.messages) return m;
            let changed = false;
            const newMsgs = Object.values(m.messages).map((msg: any) => {
               if (msg.readAt) return msg;
               if (isCreator && msg.from === 'partner') { changed = true; return { ...msg, readAt: new Date().toISOString() }; }
               if (!isCreator && msg.from === 'creator') { changed = true; return { ...msg, readAt: new Date().toISOString() }; }
               return msg;
            });
            
            if (changed) {
              membersChanged = true;
              const returnMsgs = Array.isArray(m.messages) ? newMsgs : newMsgs.reduce((acc, msg) => ({ ...acc, [msg.id]: msg }), {});
              return { ...m, messages: returnMsgs };
            }
            return m;
          });
        }
      }

      if (!convosChanged && !membersChanged) {
        return space;
      }

      return {
        ...space,
        conversations: convosChanged ? updatedConvos : space.conversations,
        members: membersChanged ? updatedMembers : space.members
      };
    });
  };

  const approveExtension = (spaceId: string, memberId: string) => {
    saveSpaceUpdate(spaceId, space => {
      triggerPushNotification([memberId], space.title, 'מנהל הקבוצה אישר את בקשת ההצטרפות שלך! יש לך כעת 24 שעות להיכנס.', { url: `/space/${spaceId}` });
      return {
        ...space,
        members: (space.members || []).map(m => {
          if (m.userId !== memberId) return m;
          return { ...m, status: 'pending' as const, joinedAt: new Date().toISOString(), extensionMessage: '' };
        })
      };
    });
  };

  const setExtensionMessage = (spaceId: string, memberId: string, message: string) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      members: (space.members || []).map(m =>
        m.userId === memberId ? { ...m, extensionMessage: message } : m
      )
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
        updatedAt: '\u05e2\u05d5\u05d3\u05db\u05df \u05e2\u05db\u05e9\u05d9\u05d5'
      };
    });
  };

  
// ==========================================
// SMART SHARES BALANCING ENGINE
// ==========================================
const calculateBalancedShares = (members: any[], settings: any) => {
  const activeMembers = members.filter(m => m.isActive !== false);
  let unlockedCount = 0;
  let partnersLockedPercentage = 0;

  // First pass: sum up locked partners
  activeMembers.forEach(m => {
    if (m.isCustomShare) {
      partnersLockedPercentage += (m.sharePercentage || 0);
    } else {
      unlockedCount += 1;
    }
  });

  const isCreatorLocked = settings?.isCustomShare === true;
  let creatorLockedValue = settings?.mySharePercentage || 0;

  // If creator is locked, but partners take up too much, the creator MUST yield
  if (isCreatorLocked) {
    creatorLockedValue = Math.min(creatorLockedValue, Math.max(0, 100 - partnersLockedPercentage));
  } else {
    unlockedCount += 1;
  }

  const totalLocked = partnersLockedPercentage + (isCreatorLocked ? creatorLockedValue : 0);
  const remainingPercentage = Math.max(0, 100 - totalLocked);
  const defaultShare = unlockedCount > 0 ? (remainingPercentage / unlockedCount) : 0;

  // If there are no unlocked members left to absorb the remainder, the creator MUST absorb it to ensure 100% total
  let finalCreatorShare = isCreatorLocked ? creatorLockedValue : defaultShare;
  if (unlockedCount === 0 && remainingPercentage > 0) {
    finalCreatorShare += remainingPercentage;
  }

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



  const removeMember = (spaceId: string, userId: string, performedBy: string, forceHardDelete: boolean = false) => {
    saveSpaceUpdate(spaceId, space => {
      const memberToRemove = space.members?.find(m => m.userId === userId);
      if (!memberToRemove) return space;

      // Check if member has any historical transactions in this space
      const hasHistory = (space.invoices || []).some(inv => 
        inv.payerId === userId || 
        (inv as any).targetId === userId || 
        (inv.approvedBy || []).includes(userId) ||
        (inv.excludedMembers || []).includes(userId)
      );

      let newMembers;
      let actionType: 'MEMBER_REMOVED' | 'MEMBER_LEFT' = 'MEMBER_REMOVED';
      let details = '';

      if (forceHardDelete || !hasHistory) {
        newMembers = space.members?.filter(m => m.userId !== userId) || [];
        details = `השותף ${memberToRemove.name} נמחק לצמיתות מהמרחב.`;
      } else {
        // Keep in historical balance records but inactivate with 0% future share
        newMembers = space.members?.map(m => m.userId === userId ? { ...m, isActive: false, sharePercentage: 0 } : m) || [];
        details = `השותף ${memberToRemove.name} סומן כלא פעיל (נשמר לצורך היסטוריית התחשבנות).`;
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


  const approveAndRouteInvoice = async (spaceId: string, invoiceData: Omit<Invoice, 'id'>, inboxItemId: string): Promise<boolean> => {
    return saveSpaceUpdate(spaceId, space => {
      const newInvoice = { ...invoiceData, id: `inv-${Date.now()}` };
      return {
        ...space,
        invoices: [newInvoice, ...(space.invoices || [])],
        inboxItems: (space.inboxItems || []).filter(item => item.id !== inboxItemId),
        updatedAt: '\u05e2\u05d5\u05d3\u05db\u05df \u05e2\u05db\u05e9\u05d9\u05d5'
      };
    });
  };

  const addInvoice = (spaceId: string, invoiceData: Omit<Invoice, 'id'>) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      invoices: [{ ...invoiceData, id: `inv-${Date.now()}` }, ...(space.invoices || [])],
      updatedAt: new Date().toISOString()
    }));

    const space = spacesBase.find(s => s.id === spaceId);
    if (space && space.members) {
      const senderName = user?.nickname || user?.realName || 'שותף';
      const title = space.title;
      const body = `${senderName} הוסיף הוצאה חדשה: ${invoiceData.amount} ₪ (${invoiceData.category || 'כללי'})`;
      const otherUserIds = space.members.filter(m => m.userId !== user?.id).map(m => m.userId);
      triggerPushNotification(otherUserIds, title, body, { url: `/space/${spaceId}` });
    }
  };

  const addInboxItems = (spaceId: string, items: Omit<InboxItem, 'id' | 'createdAt'>[]) => {
    saveSpaceUpdate(spaceId, space => {
      const newItems = items.map((item, idx) => ({
        ...item,
        id: `inbox-${Date.now()}-${idx}`,
        createdAt: new Date().toISOString()
      }));
      return {
        ...space,
        inboxItems: [...newItems, ...(space.inboxItems || [])],
        updatedAt: '\u05e2\u05d5\u05d3\u05db\u05df \u05e2\u05db\u05e9\u05d9\u05d5'
      };
    });
  };

  const updateInboxItem = (spaceId: string, itemId: string, updates: Partial<InboxItem>) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      inboxItems: (space.inboxItems || []).map(item => item.id === itemId ? { ...item, ...updates } : item),
      updatedAt: '\u05e2\u05d5\u05d3\u05db\u05df \u05e2\u05db\u05e9\u05d9\u05d5'
    }));
  };

  const removeInboxItem = (spaceId: string, itemId: string) => {
    const space = spacesBase.find(s => s.id === spaceId);
    const item = space?.inboxItems?.find(i => i.id === itemId);
    if (item?.imageUrl) {
      import('../../lib/firebase').then(({ deleteImageFromStorage }) => {
        deleteImageFromStorage(item.imageUrl);
      }).catch(console.error);
    }
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      inboxItems: (space.inboxItems || []).filter(item => item.id !== itemId),
      updatedAt: '\u05e2\u05d5\u05d3\u05db\u05df \u05e2\u05db\u05e9\u05d9\u05d5'
    }));
  };

  
  const addDocument = (spaceId: string, doc: Omit<SpaceDocument, 'id' | 'createdAt'>) => {
    const docId = `doc-${Date.now()}`;
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      documents: [{ ...doc, id: docId, createdAt: new Date().toISOString() }, ...(space.documents || [])]
    }));
    return docId;
  };

  const addDocumentAndLinkToEvent = (spaceId: string, doc: Omit<SpaceDocument, 'id' | 'createdAt'>, eventId: string) => {
    const docId = `doc-${Date.now()}`;
    const cleanEventId = String(eventId || '').trim();
    saveSpaceUpdate(spaceId, space => {
      const targetEvent = (space.shelfEvents || []).find(ev => ev.id === cleanEventId);
      const alignedShelfId = targetEvent?.shelfId || doc.shelfId;
      const newDoc: SpaceDocument = { 
        ...doc, 
        shelfId: alignedShelfId,
        id: docId, 
        createdAt: new Date().toISOString() 
      };

      const updatedEvents = (space.shelfEvents || []).map(ev => {
        if (ev.id === cleanEventId) {
          const currentDocIds = ev.documentIds || [];
          return {
            ...ev,
            documentIds: currentDocIds.includes(docId) ? currentDocIds : [...currentDocIds, docId]
          };
        }
        return ev;
      });

      return {
        ...space,
        documents: [newDoc, ...(space.documents || [])],
        shelfEvents: updatedEvents
      };
    });
    return docId;
  };

  const updateDocument = (spaceId: string, docId: string, updates: Partial<SpaceDocument>) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      documents: (space.documents || []).map(d => d.id === docId ? { ...d, ...updates } : d)
    }));
  };

  const removeDocument = (spaceId: string, docId: string) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      documents: (space.documents || []).filter(d => d.id !== docId)
    }));
  };

  const addShelf = (spaceId: string, shelf: Omit<DocumentShelf, 'id' | 'createdAt'>) => {
    const shelfId = `shelf-${Date.now()}`;
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      shelves: [...(space.shelves || []), { ...shelf, id: shelfId, createdAt: new Date().toISOString() }]
    }));
    return shelfId;
  };

  const updateShelf = (spaceId: string, shelfId: string, updates: Partial<DocumentShelf>) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      shelves: (space.shelves || []).map(s => s.id === shelfId ? { ...s, ...updates } : s)
    }));
  };

  const removeShelf = (spaceId: string, shelfId: string) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      shelves: (space.shelves || []).filter(s => s.id !== shelfId)
    }));
  };

  const addShelfEvent = (spaceId: string, event: Omit<ShelfEvent, 'id' | 'createdAt' | 'createdBy' | 'comments'>) => {
    const newEvent: ShelfEvent = {
      ...event,
      id: Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
      createdBy: user?.id || '',
      comments: []
    };
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      shelfEvents: [...(space.shelfEvents || []), newEvent]
    }));
  };

  const updateShelfEvent = (spaceId: string, eventId: string, updates: Partial<ShelfEvent>) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      shelfEvents: (space.shelfEvents || []).map(e => e.id === eventId ? { ...e, ...updates } : e)
    }));
  };

  const removeShelfEvent = (spaceId: string, eventId: string) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      shelfEvents: (space.shelfEvents || []).filter(e => e.id !== eventId)
    }));
  };

  const addShelfEventComment = (spaceId: string, eventId: string, text: string) => {
    saveSpaceUpdate(spaceId, space => {
      let eventTitle = '';
      const newSpace = {
        ...space,
        shelfEvents: (space.shelfEvents || []).map(e => {
          if (e.id === eventId) {
            eventTitle = e.title;
            const newComment: ShelfEventComment = {
              id: Math.random().toString(36).substring(2, 9),
              userId: user?.id || '',
              text,
              createdAt: new Date().toISOString()
            };
            return { ...e, comments: [...(e.comments || []), newComment] };
          }
          return e;
        })
      };

      setTimeout(() => {
        const senderName = user?.realName || user?.nickname || 'שותף';
        const allIds = [space.creatorId, ...(space.members || []).map((m: any) => m.userId)];
        // Add anyone else who commented on this event (useful if guests don't have user.id)
        const event = space.shelfEvents?.find(e => e.id === eventId);
        if (event?.comments) {
           event.comments.forEach(c => allIds.push(c.userId));
        }
        
        const otherUserIds = Array.from(new Set(allIds)).filter(id => id && id !== user?.id);
        
        if (otherUserIds.length > 0) {
          const inboxItems = otherUserIds.map(uid => ({
            userId: uid,
            type: 'timeline_comment' as any,
            title: 'תגובה חדשה במסמכים',
            message: `${senderName} הגיב על "${eventTitle}": ${text}`,
            isRead: false,
            actionUrl: `/space/${spaceId}?tab=documents`
          }));
          
        }
      }, 0);

      return newSpace;
    });
  };

  const removeShelfEventComment = (spaceId: string, eventId: string, commentId: string) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      shelfEvents: (space.shelfEvents || []).map(e => {
        if (e.id === eventId) {
          return { ...e, comments: (e.comments || []).filter(c => c.id !== commentId) };
        }
        return e;
      })
    }));
  };

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
    
      // Trigger push notification if it's a message or photo
      if (item.type === 'message' || item.type === 'photo') {
        const space = spacesBase.find(s => s.id === spaceId);
        if (space && space.members) {
          const senderName = user?.nickname || user?.realName || 'שותף';
          const title = space.title;
          const body = item.type === 'message' ? `${senderName}: ${item.url}` : `${senderName} שיתף תמונה חדשה`; // url holds the message text for type='message'
          const otherUserIds = space.members.filter(m => m.userId !== user?.id).map(m => m.userId);
          triggerPushNotification(otherUserIds, title, body, { url: `/space/${spaceId}` });
        }
      }
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
    const item = mediaItemsBySpace[spaceId]?.find(m => m.id === mediaId);
    if (item?.url) {
      import('../../lib/firebase').then(({ deleteImageFromStorage }) => {
        deleteImageFromStorage(item.url);
      }).catch(console.error);
    }
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
    <SpacesContext.Provider value={{ spaces, getRoleForSpace, getTokenForSpace, addSpace, deleteSpace, permanentlyDeleteSpace, restoreSpace, updateSpaceTitle, updateSpaceDate, updateSpaceCover, updateSpaceLogo, updateSpaceIcon, toggleFeature, updateSpaceSettings, updateInvoice, addInvoice, approveAndRouteInvoice, addInboxItems, updateInboxItem, removeInboxItem, addMediaItem, updateMediaItem, removeMediaItem, addDocument, addDocumentAndLinkToEvent, updateDocument, removeDocument, addShelf, updateShelf, removeShelf, addShelfEvent, updateShelfEvent, removeShelfEvent, addShelfEventComment, removeShelfEventComment, likeMediaItem, joinSpace, finalizeGuestJoin, declinePendingInvite, createPendingInvite, migrateGuestToRealUser,
      requestGroupJoin,
      approveGroupMember,
      rejectGroupMember,
      approveAllGroupMembers,
      updateMemberPermissions,
      sendConversationMessage,
        markConversationRead,
      
      approveExtension,
      setExtensionMessage, updateSharesBulk,
    approveShareChange,
    rejectShareChange,
        updateMemberStatus, updateMemberRole,
        
      addComment,
      deleteComment,
      removeMember,
      autoBalanceShares,
      devResetSpace,
      addAuditLog,
      updateAlbumSettings,
      updateAtmospherePhoto,
      moveMediaItem,
      isLoaded,
        personalInbox,
        setPersonalInbox,
        fetchPersonalInbox,
        addToPersonalInbox,
        removeFromPersonalInbox,
        updatePersonalInboxItem
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







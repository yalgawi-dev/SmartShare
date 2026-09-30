'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { AVAILABLE_FEATURES } from '../data/features';
import { isPartnerExpired } from '../../utils/partnerUtils';
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

export interface SpaceSettings {
  isCustomShare?: boolean;
  customCategories?: string[];
  pendingExpirationHours?: number;
  defaultVatRate: number;
  allowPartnersToEditWall: boolean;
  mySharePercentage?: number;
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

export interface Space {
  creatorId?: string;
  createdBy?: string;
  createdAt?: string;
  pendingInvites?: any[];
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
  restoreSpace: (spaceId: string) => void;
  updateSpaceTitle: (spaceId: string, newTitle: string) => void;
  updateSpaceDate: (spaceId: string, newDate: string) => void;
  updateSpaceCover: (spaceId: string, newCoverUrl: string) => void;
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
  removeMediaItem: (spaceId: string, mediaId: string) => void;
  likeMediaItem: (spaceId: string, mediaId: string) => void;
  addComment: (spaceId: string, mediaId: string, comment: Omit<Comment, 'id' | 'timestamp'>) => void;
  deleteComment: (spaceId: string, mediaId: string, commentId: string) => void;
  updateMemberPermissions: (spaceId: string, userId: string, permissions: Partial<SpaceMember>) => void;
  updateMemberStatus: (spaceId: string, userId: string, status: 'active' | 'pending' | 'disputed', message?: string) => void;
  
  refreshMemberInvite: (spaceId: string, userId: string) => void;
  removeMember: (spaceId: string, userId: string, performedBy: string, forceHardDelete?: boolean) => void;
  restoreMember: (spaceId: string, userId: string, performedBy: string) => void;
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
  pendingExpirationHours: 24,
  defaultVatRate: 18, 
  allowPartnersToEditWall: false,
};

const initialSpaces: Space[] = [
  {
    id: '1',
    title: '׳³ג€˜׳³ֲ ׳³ג„¢׳³ג„¢׳³ֳ— ׳³ג€׳³ג€˜׳³ג„¢׳³ֳ— ׳³ג€˜׳³ג€÷׳³ג‚×׳³ֲ¨',
    description: '׳³ֲ ׳³ג„¢׳³ג€׳³ג€¢׳³ֲ ׳³ג€׳³ג€¢׳³ֲ¦׳³ֲ׳³ג€¢׳³ֳ—, ׳³ֲ§׳³ג€˜׳³ֲ׳³ֲ ׳³ג„¢׳³ֲ, ׳³ג€׳³ֲ¢׳³ֲ׳³ֲ׳³ֳ— ׳³ג€”׳³ֲ©׳³ג€˜׳³ג€¢׳³ֲ ׳³ג„¢׳³ג€¢׳³ֳ— ׳³ג€¢׳³ֳ—׳³ג€¢׳³ג€÷׳³ֲ ׳³ג„¢׳³ג€¢׳³ֳ— ׳³ֲ׳³ג€׳³ֲ¨׳³ג„¢׳³ג€÷׳³ֲ׳³ג„¢׳³ג€¢׳³ֳ— ׳³ג€˜׳³ֲ׳³ֲ§׳³ג€¢׳³ֲ ׳³ֲ׳³ג€”׳³ג€.',
    icon: '׳ ֲֲֲ ',
    updatedAt: '׳³ֲ׳³ג‚×׳³ֲ ׳³ג„¢ 2 ׳³ג€׳³ֲ§׳³ג€¢׳³ֳ—',
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
        return { id: doc.id, ...data } as Omit<Space, 'mediaItems'>;
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
         alert("׳³ֲ©׳³ג€™׳³ג„¢׳³ֲ׳³ֳ— ׳³ג€׳³ֳ—׳³ג€”׳³ג€˜׳³ֲ¨׳³ג€¢׳³ֳ— ׳³ֲ׳³ֲ׳³ֲ¡׳³ג€ ׳³ג€׳³ֲ ׳³ֳ—׳³ג€¢׳³ֲ ׳³ג„¢׳³ֲ: " + (error.message || ""));
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
    if (!user?.id || !user?.realName || user.realName === '׳³ֲ׳³ג€¢׳³ֲ¨׳³ג€”' || user.realName === '׳³ֲ׳³ג€¢׳³ֲ¨׳³ג€” ׳³ֲ׳³ֲ ׳³ג€¢׳³ֲ ׳³ג„¢׳³ֲ׳³ג„¢' || spacesBase.length === 0) return;
    
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

  
  // COMPLETE ARCHITECTURAL CLEANUP: Auto-migrate legacy guest IDs to real UIDs
  useEffect(() => {
    if (!user || !user.id || spacesBase.length === 0) return;
    if (typeof window === 'undefined') return;

    try {
      const localKeys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
      
      spacesBase.forEach(space => {
        const spaceKey = localKeys[space.id];
        if (!spaceKey || !spaceKey.token) return;
        
        const guestId = spaceKey.token;
        if (guestId === user.id) return; // Already migrated

        const hasGuestMember = space.members?.some((m: any) => m.userId === guestId);
        if (hasGuestMember) {
          console.log(`Migrating legacy guest ID ${guestId} to real UID ${user.id} for space ${space.id}`);
          
          saveSpaceUpdate(space.id, currentSpace => {
            // Update members
            const members = (currentSpace.members || []).map(m => 
              m.userId === guestId ? { ...m, userId: user.id } : m
            );
            
            // Update invoices
            const invoices = (currentSpace.invoices || []).map(inv => {
              const newInv = { ...inv } as any;
              if (newInv.payerId === guestId) newInv.payerId = user.id;
              if (newInv.rejectedById === guestId) newInv.rejectedById = user.id;
              if (newInv.excludedMembers) newInv.excludedMembers = newInv.excludedMembers.map(id => id === guestId ? user.id : id);
              if (newInv.approvedBy) newInv.approvedBy = newInv.approvedBy.map(id => id === guestId ? user.id : id);
              return newInv;
            });
            
            // Update conversations
            const conversations = (currentSpace.conversations || []).map(c => {
              const newC = { ...c };
              if (newC.participants) newC.participants = newC.participants.map(id => id === guestId ? user.id : id);
              // Fix conversation ID if it contained the guest ID
              if (newC.id.includes(guestId)) {
                newC.id = newC.participants.filter(id => id !== 'group').sort().join('_');
              }
              if (newC.messages) {
                newC.messages = newC.messages.map(msg => ({
                  ...msg,
                  senderId: msg.senderId === guestId ? user.id : msg.senderId,
                  readBy: (msg.readBy || []).map(id => id === guestId ? user.id : id)
                }));
              }
              return newC;
            });

            return { ...currentSpace, members, invoices, conversations };
          });
          
          // Clear it from localStorage so we don't migrate again
          localKeys[space.id].token = user.id;
          localStorage.setItem('smartshare_keys', JSON.stringify(localKeys));
          
          // Move from smartshare_guest_tokens if it's there
          const guestTokens = JSON.parse(localStorage.getItem('smartshare_guest_tokens') || '[]');
          const filteredTokens = guestTokens.filter((t: string) => t !== guestId);
          if (filteredTokens.length !== guestTokens.length) {
            localStorage.setItem('smartshare_guest_tokens', JSON.stringify(filteredTokens));
          }
        }
      });
    } catch (e) {
      console.error('Guest migration error', e);
    }
  }, [user?.id, spacesBase.length]);

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
          updates.createdBy = user.realName || user.nickname || '׳³ג„¢׳³ג€¢׳³ֲ¦׳³ֲ¨ ׳³ג€׳³ֲ׳³ֲ¨׳³ג€”׳³ג€˜';
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
    if (!user || !user.id) throw new Error("No user");
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
      updatedAt: '׳³ֲ ׳³ג€¢׳³ֲ¦׳³ֲ¨ ׳³ג€׳³ֲ¨׳³ג€™׳³ֲ¢',
      settings: defaultSettings,
      invoices: [],
      members: [],
      /* masterKey: masterKey, */
      creatorId: user?.id || undefined,
      createdBy: user?.realName || user?.nickname || '׳³ג„¢׳³ג€¢׳³ֲ¦׳³ֲ¨ ׳³ג€׳³ֲ׳³ֲ¨׳³ג€”׳³ג€˜'
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
        alert("׳³ֲ©׳³ג€™׳³ג„¢׳³ֲ׳³ג€ ׳³ג€˜׳³ֲ׳³ג€”׳³ג„¢׳³ֲ§׳³ֳ— ׳³ג€׳³ֲ׳³ֲ¨׳³ג€”׳³ג€˜ (׳³ג„¢׳³ג„¢׳³ֳ—׳³ג€÷׳³ֲ ׳³ֲ©׳³ֲ׳³ג„¢׳³ֲ ׳³ֲ׳³ֲ ׳³ג€׳³ֲ¨׳³ֲ©׳³ֲ׳³ג€¢׳³ֳ— ׳³ֲ׳³ג€”׳³ג„¢׳³ֲ§׳³ג€): " + (e.message || ""));
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
          'finance': '׳³ג€׳³ֳ—׳³ג€”׳³ֲ©׳³ג€˜׳³ֲ ׳³ג€¢׳³ֳ—',
          'scanner': '׳³ֲ¡׳³ג€¢׳³ֲ¨׳³ֲ§ ׳³ג€”׳³ג€÷׳³ֲ',
          'partners': '׳³ֲ©׳³ג€¢׳³ֳ—׳³ג‚×׳³ג„¢׳³ֲ',
          'guestbook': '׳³ֲ¡׳³ג‚×׳³ֲ¨ ׳³ֲ׳³ג€¢׳³ֲ¨׳³ג€”׳³ג„¢׳³ֲ',
          'gallery': '׳³ג€™׳³ֲ׳³ֲ¨׳³ג„¢׳³ג€'
        };
        const fName = featureNameMap[featureId] || featureId;
        const newLog: AuditRecord = {
          id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          timestamp: new Date().toISOString(),
          actionType: isRemoving ? 'SYSTEM_ALERT' : 'SYSTEM_ALERT',
          performedBy,
          details: isRemoving ? `׳³ג€׳³ֲ¡׳³ג„¢׳³ֲ¨/׳³ג€ ׳³ֲ׳³ֳ— ׳³ֳ—׳³ג€¢׳³ֲ¡׳³ֲ£ "${fName}" ׳³ֲ׳³ג€׳³ֲ׳³ֲ¨׳³ג€”׳³ג€˜` : `׳³ג€׳³ג€¢׳³ֲ¡׳³ג„¢׳³ֲ£/׳³ג€ ׳³ֲ׳³ֳ— ׳³ֳ—׳³ג€¢׳³ֲ¡׳³ֲ£ "${fName}" ׳³ֲ׳³ֲ׳³ֲ¨׳³ג€”׳³ג€˜`
        };
        newSpace.auditLogs = [newLog, ...(space.auditLogs || [])];
      }

      return newSpace;
    });
  };

  const updateSpaceTitle = (spaceId: string, newTitle: string) => {
    saveSpaceUpdate(spaceId, space => ({ ...space, title: newTitle, updatedAt: '׳³ֲ¢׳³ג€¢׳³ג€׳³ג€÷׳³ֲ ׳³ֲ¢׳³ג€÷׳³ֲ©׳³ג„¢׳³ג€¢' }));
  };

  const updateSpaceDate = (spaceId: string, newDate: string) => {
    saveSpaceUpdate(spaceId, space => ({ ...space, date: newDate, updatedAt: '׳³ֲ¢׳³ג€¢׳³ג€׳³ג€÷׳³ֲ ׳³ֲ¢׳³ג€÷׳³ֲ©׳³ג„¢׳³ג€¢' }));
  };

  const updateSpaceCover = (spaceId: string, newCoverUrl: string) => {
    saveSpaceUpdate(spaceId, space => ({ ...space, coverImage: newCoverUrl, updatedAt: '׳³ֲ¢׳³ג€¢׳³ג€׳³ג€÷׳³ֲ ׳³ֲ¢׳³ג€÷׳³ֲ©׳³ג„¢׳³ג€¢' }));
  };

  const updateSpaceIcon = (spaceId: string, newIcon: string) => {
    saveSpaceUpdate(spaceId, space => ({ ...space, icon: newIcon, updatedAt: '׳³ֲ¢׳³ג€¢׳³ג€׳³ג€÷׳³ֲ ׳³ֲ¢׳³ג€÷׳³ֲ©׳³ג„¢׳³ג€¢' }));
  };

  const updateSpaceSettings = (spaceId: string, newSettings: Partial<SpaceSettings>) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      settings: { ...space.settings, ...newSettings },
      updatedAt: '׳³ֲ¢׳³ג€¢׳³ג€׳³ג€÷׳³ֲ ׳³ֲ¢׳³ג€÷׳³ֲ©׳³ג„¢׳³ג€¢'
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
        let actionLabel = isDelete ? "׳³ֲ׳³ג€”׳³ֲ§/׳³ג€ ׳³ג€׳³ג€¢׳³ֲ¦׳³ֲ׳³ג€" : isRestore ? "׳³ֲ©׳³ג€”׳³ג€“׳³ֲ¨/׳³ג€ ׳³ג€׳³ג€¢׳³ֲ¦׳³ֲ׳³ג€ ׳³ֲ׳³ג€”׳³ג€¢׳³ֲ§׳³ג€" : "׳³ֲ¢׳³ֲ¨׳³ֲ/׳³ג€ ׳³ג€׳³ג€¢׳³ֲ¦׳³ֲ׳³ג€";
        const amt = oldInvoice.amount ? ` ׳³ֲ¢"׳³ֲ¡ ׳’ג€ֳ—${oldInvoice.amount}` : "";
        const supplier = oldInvoice.supplier || "׳³ֲ¡׳³ג‚×׳³ֲ§ ׳³ג€÷׳³ֲ׳³ֲ׳³ג„¢";
        
        const performer = performedBy === "me" || !performedBy ? "׳³ֲ׳³ֲ©׳³ֳ—׳³ֲ׳³ֲ©" : performedBy;
        
        const newLog = {
          id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          timestamp: new Date().toISOString(),
          actionType: (isDelete ? "DELETE_INVOICE" : "EDIT_INVOICE") as any,
          performedBy,
          details: `${performer} ${actionLabel}${amt} ׳³ֲ׳³ֲ׳³ֳ— "${supplier}". ׳³ג‚×׳³ג„¢׳³ֲ¨׳³ג€¢׳³ֻ: ${actionDetail}`,
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
      
      const updatePresence = () => {
        if (!db || !user?.id) return;
        const userRef = doc(db, 'users', user.id);
        updateDoc(userRef, { lastActiveAt: new Date().toISOString() }).catch(() => {});
      };
      
      updatePresence();
      const interval = setInterval(updatePresence, 2 * 60 * 1000);
      return () => { clearInterval(interval); };
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
        name: name.trim() || pendingInvite?.name || existingMember?.name || '׳³ֲ©׳³ג€¢׳³ֳ—׳³ֲ£ ׳³ֲ׳³ג€¢׳³ג€“׳³ֲ׳³ֲ',
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
      
      const newPendingInvites = (space.pendingInvites || []).filter(i => i.token !== userId && i.token !== inviteToken);

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
        name: inviteData.name?.trim() || '׳³ֲ©׳³ג€¢׳³ֳ—׳³ֲ£ ׳³ֲ׳³ג€¢׳³ג€“׳³ֲ׳³ֲ',
        guestShare: inviteData.guestShare,
        creatorShare: inviteData.creatorShare,
        partnerShares: inviteData.partnerShares || null,
        isRetroactive: inviteData.isRetroactive,
          createdAt: new Date().toISOString(),
          targetUserId: inviteData.targetUserId
      };

      return {
        ...space,
        pendingInvites: [...(space.pendingInvites || []), newInvite]
      };
    });
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

  // ׳’ג€ג‚¬׳’ג€ג‚¬׳’ג€ג‚¬ Operational Messages (2-way private creator׳’ג€ ג€partner) ׳’ג€ג‚¬׳’ג€ג‚¬׳’ג€ג‚¬׳’ג€ג‚¬׳’ג€ג‚¬׳’ג€ג‚¬׳’ג€ג‚¬׳’ג€ג‚¬׳’ג€ג‚¬׳’ג€ג‚¬׳’ג€ג‚¬
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
      return { ...space, conversations: updatedConvos };
    });
  };

  const markConversationRead = (spaceId: string, conversationId: string, readerId: string) => {
    saveSpaceUpdate(spaceId, space => {
      const convos = space.conversations || [];
      const updatedConvos = convos.map(c => {
        if (c.id !== conversationId) return c;
        return { ...c, messages: c.messages.map(msg => { if (!msg.readBy.includes(readerId)) { return { ...msg, readBy: [...msg.readBy, readerId] }; } return msg; }) };
      });
      
      let updatedMembers = space.members;
      if (conversationId !== 'group') {
        const isCreator = readerId === space.creatorId;
        const otherUserId = conversationId.split('_').find(id => id !== readerId);
        updatedMembers = (space.members || []).map(m => {
           const targetMemberId = isCreator ? otherUserId : readerId;
           if (m.userId !== targetMemberId) return m;
           
           if (!m.messages) return m;
           let changed = false;
           const newMsgs = Object.values(m.messages).map((msg: any) => {
              if (msg.readAt) return msg;
              if (isCreator && msg.from === 'partner') { changed = true; return { ...msg, readAt: new Date().toISOString() }; }
              if (!isCreator && msg.from === 'creator') { changed = true; return { ...msg, readAt: new Date().toISOString() }; }
              return msg;
           });
           
           // If m.messages was originally an object/record (legacy), map it back to object
           const returnMsgs = Array.isArray(m.messages) ? newMsgs : newMsgs.reduce((acc, msg) => ({ ...acc, [msg.id]: msg }), {});
           
           return changed ? { ...m, messages: returnMsgs } : m;
        });
      }

      return { ...space, conversations: updatedConvos, members: updatedMembers };
    });
  };

  const approveExtension = (spaceId: string, memberId: string) => {
    saveSpaceUpdate(spaceId, space => {
      triggerPushNotification([memberId], space.title, '׳³ֲ׳³ֲ ׳³ג€׳³ֲ ׳³ג€׳³ֲ§׳³ג€˜׳³ג€¢׳³ֲ¦׳³ג€ ׳³ֲ׳³ג„¢׳³ֲ©׳³ֲ¨ ׳³ֲ׳³ֳ— ׳³ג€˜׳³ֲ§׳³ֲ©׳³ֳ— ׳³ג€׳³ג€׳³ֲ¦׳³ֻ׳³ֲ¨׳³ג‚×׳³ג€¢׳³ֳ— ׳³ֲ©׳³ֲ׳³ֲ! ׳³ג„¢׳³ֲ© ׳³ֲ׳³ֲ ׳³ג€÷׳³ֲ¢׳³ֳ— 24 ׳³ֲ©׳³ֲ¢׳³ג€¢׳³ֳ— ׳³ֲ׳³ג€׳³ג„¢׳³ג€÷׳³ֲ ׳³ֲ¡.', { url: `/space/${spaceId}` });
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
        updatedAt: '׳³ֲ¢׳³ג€¢׳³ג€׳³ג€÷׳³ֲ ׳³ֲ׳³ג‚×׳³ֲ ׳³ג„¢ ׳³ֲ¨׳³ג€™׳³ֲ¢'
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
        details: `׳³ג€׳³ֲ׳³ֲ¢׳³ֲ¨׳³ג€÷׳³ֳ— ׳³ג€”׳³ג„¢׳³ֲ׳³ֲ§׳³ג€ ׳³ֲ׳³ֳ— ׳³ג€׳³ֲ׳³ג€”׳³ג€¢׳³ג€“׳³ג„¢׳³ֲ ׳³ג€׳³ֲ ׳³ג€¢׳³ֳ—׳³ֲ¨׳³ג„¢׳³ֲ ׳³ֲ©׳³ג€¢׳³ג€¢׳³ג€ ׳³ג€˜׳³ֲ©׳³ג€¢׳³ג€¢׳³ג€ (${defaultShare.toFixed(1)}% ׳³ֲ׳³ג€÷׳³ֲ ׳³ג€”׳³ֲ׳³ֲ§).`
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
        if (m.userId === userId && (m.status === 'pending' || m.status === 'extension_requested')) {
          return { ...m, status: 'pending', joinedAt: new Date().toISOString() };
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
        details = `׳³ג€׳³ֲ©׳³ג€¢׳³ֳ—׳³ֲ£ ${memberToRemove.name} ׳³ֲ ׳³ֲ׳³ג€”׳³ֲ§ ׳³ֲ׳³ֲ¦׳³ֲ׳³ג„¢׳³ֳ—׳³ג€¢׳³ֳ—.`;
      } else {
        newMembers = space.members?.map(m => m.userId === userId ? { ...m, isActive: false, sharePercentage: undefined } : m) || [];
        details = `׳³ג€׳³ֲ©׳³ג€¢׳³ֳ—׳³ֲ£ ${memberToRemove.name} ׳³ֲ¡׳³ג€¢׳³ֲ׳³ֲ ׳³ג€÷׳³ֲ׳³ֲ-׳³ג‚×׳³ֲ¢׳³ג„¢׳³ֲ.`;
      }
      
      const newLog: AuditRecord = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        actionType,
        performedBy,
        details
      };
      
      // If shares were custom, give the removed member's share back to the creator.
      // Do NOT wipe isCustomShare, as other partners might still have their custom shares!
      let newCreatorShare = space.settings?.mySharePercentage;
      if (space.settings?.isCustomShare) {
        const removedShare = memberToRemove.sharePercentage || 0;
        if (newCreatorShare !== undefined) {
          newCreatorShare = Math.min(100, newCreatorShare + removedShare);
        }
      }

      const newSettings = { 
        ...space.settings, 
        mySharePercentage: space.settings?.isCustomShare ? newCreatorShare : undefined 
      };

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
        details: `׳³ג€׳³ֲ©׳³ג€¢׳³ֳ—׳³ֲ£ ${memberToRestore.name} ׳³ג€׳³ג€¢׳³ג€”׳³ג€“׳³ֲ¨ ׳³ֲ׳³ג‚×׳³ֲ¢׳³ג„¢׳³ֲ׳³ג€¢׳³ֳ—.`
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
        updatedAt: '׳³ֲ¢׳³ג€¢׳³ג€׳³ג€÷׳³ֲ ׳³ג€׳³ֲ¨׳³ג€™׳³ֲ¢'
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
      const senderName = user?.nickname || user?.realName || '׳³ֲ©׳³ג€¢׳³ֳ—׳³ֲ£';
      const title = space.title;
      const body = `${senderName} ׳³ג€׳³ג€¢׳³ֲ¡׳³ג„¢׳³ֲ£ ׳³ג€׳³ג€¢׳³ֲ¦׳³ֲ׳³ג€ ׳³ג€”׳³ג€׳³ֲ©׳³ג€: ${invoiceData.amount} ׳’ג€ֳ— (${invoiceData.category || '׳³ג€÷׳³ֲ׳³ֲ׳³ג„¢'})`;
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
        updatedAt: '׳³ֲ¢׳³ג€¢׳³ג€׳³ג€÷׳³ֲ ׳³ֲ¢׳³ג€÷׳³ֲ©׳³ג„¢׳³ג€¢'
      };
    });
  };

  const updateInboxItem = (spaceId: string, itemId: string, updates: Partial<InboxItem>) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      inboxItems: (space.inboxItems || []).map(item => item.id === itemId ? { ...item, ...updates } : item),
      updatedAt: '׳³ֲ¢׳³ג€¢׳³ג€׳³ג€÷׳³ֲ ׳³ֲ¢׳³ג€÷׳³ֲ©׳³ג„¢׳³ג€¢'
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
      updatedAt: '׳³ֲ¢׳³ג€¢׳³ג€׳³ג€÷׳³ֲ ׳³ֲ¢׳³ג€÷׳³ֲ©׳³ג„¢׳³ג€¢'
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
          const senderName = user?.nickname || user?.realName || '׳³ֲ©׳³ג€¢׳³ֳ—׳³ֲ£';
          const title = space.title;
          const body = item.type === 'message' ? `${senderName}: ${item.url}` : `${senderName} ׳³ֲ©׳³ג„¢׳³ֳ—׳³ֲ£ ׳³ֳ—׳³ֲ׳³ג€¢׳³ֲ ׳³ג€ ׳³ג€”׳³ג€׳³ֲ©׳³ג€`; // url holds the message text for type='message'
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
    <SpacesContext.Provider value={{ spaces, getRoleForSpace, getTokenForSpace, addSpace, deleteSpace, restoreSpace, updateSpaceTitle, updateSpaceDate, updateSpaceCover, updateSpaceIcon, toggleFeature, updateSpaceSettings, updateInvoice, addInvoice, approveAndRouteInvoice, addInboxItems, updateInboxItem, removeInboxItem, addMediaItem, updateMediaItem, removeMediaItem, likeMediaItem, joinSpace, finalizeGuestJoin, declinePendingInvite, createPendingInvite, migrateGuestToRealUser,
      updateMemberPermissions,
      sendConversationMessage,
        markConversationRead,
      
      approveExtension,
      setExtensionMessage, updateSharesBulk,
    approveShareChange,
    rejectShareChange,
        updateMemberStatus,
        
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







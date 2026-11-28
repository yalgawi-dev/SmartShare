import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, increment } from 'firebase/firestore';

export type RecipientRole = 'client' | 'provider' | 'general';

export interface RecipientShareLink {
  id: string;
  recipientName: string;
  role?: RecipientRole; // 'client' = מקבל שירות, 'provider' = נותן שירות, 'general' = שותף/כללי
  phone?: string;
  token: string;
  enabled: boolean;
  createdAt: number;
  viewCount: number;
  totalDurationSeconds?: number;
  lastViewedAt: number | null;
  submissionFolderId?: string; // ID of personal folder created in space for this recipient
  internalNote?: string; // 🔒 הערה פנימית פרטית (רק לעיני המנהלים - לא גלוי לנמען!)
  publicMessage?: string; // ✉️ הודעה גלויה לנמען (מוצגת בדף השיתוף)
  chatChannelId?: string; // מזהה שיחה ייעודי עם האורח
  origin?: 'manual' | 'public_link'; // 'public_link' = אורח שנרשם אוטומטית מקישור כללי
  sourceChannel?: string; // זיהוי ערוץ שקט אוטומטי (אינסטגרם / פייסבוק / וואטסאפ / מייל / קישור ישיר)
  profession?: string; // תחום עיסוק / מקצוע של האורח (קבלן שלד, אינסטלטור, אדריכל, לקוח וכו')
}

export interface ShareLinkConfig {
  enabled: boolean;
  token?: string;
  requirePin: boolean;
  pin?: string;
  requireGuestIdentity?: boolean; // default true: אורח לא מוכר מלינק כללי מזדהה עם שם וטלפון פעם אחת
  expiresAt: number | null; // timestamp in ms, or null for no expiry
  allowDownload: boolean;   // if false: view-only mode
  allowUploads?: boolean;  // if true: recipient can upload submissions / quotes
  includeSubtree?: boolean; // if true: exposes all descendant subfolders and files under this folder
  viewCount?: number;
  totalDurationSeconds?: number;
  lastViewedAt?: number | null;
  createdAt?: number;
  recipients?: RecipientShareLink[];
}

export interface FolderPartnerPermission {
  partnerId: string;
  name?: string;
  role: 'admin' | 'viewer'; // 'admin' = מנהל תיקייה (יכול להעלות, למחוק, לנהל), 'viewer' = צופה בלבד
  partnerType?: 'provider' | 'client' | 'general'; // ספק / קבלן, לקוח / מזמין, שותף כללי
  assignedAt?: number;
}

export interface FileShareItem {
  id: string;
  spaceId: string;
  name: string;
  type: 'file' | 'folder';
  parentId: string | null; // null = root level
  url?: string;
  thumbnailUrl?: string;
  pages?: string[];        // for multi-page documents
  fileType?: 'pdf' | 'image' | 'doc' | 'sheet' | 'other';
  rawPdfUrl?: string;
  size?: number;           // bytes
  createdAt: number;       // timestamp in ms
  createdBy: string;       // user id
  creatorName: string;
  allowedPartners?: string[]; // empty array = open to all space members (Rule 20)
  folderPartners?: FolderPartnerPermission[]; // Local folder partners with custom permissions & roles
  shareLink?: ShareLinkConfig;
  isFavorite?: boolean;
  deletedAt?: string;
  linkedSourceId?: string;
  linkedSourceType?: 'vault_doc' | 'vault_folder' | 'invoice';
  /** Structured business card of the external guest/contractor who submitted files into this folder */
  senderContactCard?: {
    name: string;
    phone?: string;
    profession?: string;
    roleLabel?: string;
    chatChannelId?: string;
  };
}

/**
 * Recursively removes all `undefined` values and converts them to safe Firestore equivalents
 * to completely eliminate `Unsupported field value: undefined` exceptions in Firebase SDK.
 */
export function sanitizeFirestoreData<T = any>(data: T): T {
  if (data === undefined) return null as any;
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map(item => sanitizeFirestoreData(item)) as any;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      clean[key] = sanitizeFirestoreData(value);
    }
  }
  return clean as T;
}

export interface BusinessCardShareData {
  businessName?: string;
  slogan?: string;
  phone?: string;
  whatsapp?: string;
  websiteUrl?: string;
  portfolioUrl?: string;
  portfolioDescription?: string;
  logoUrl?: string;
}

export interface PublicSharedData {
  token: string;
  spaceId: string;
  spaceTitle: string;
  spaceLogoUrl?: string;
  features?: string[];
  businessCard?: BusinessCardShareData;
  itemId: string;
  itemType: 'file' | 'folder';
  name: string;
  recipientName?: string;
  recipientId?: string;
  recipientRole?: RecipientRole;
  recipientPhone?: string;
  internalNote?: string;   // 🔒 הערה פנימית פרטית (רק לעיני המנהלים)
  publicMessage?: string; // ✉️ הודעה אישית גלויה לנמען
  chatChannelId?: string; // 💬 מזהה שיחה ישירה עם מנהל המרחב
  url?: string;
  thumbnailUrl?: string;
  pages?: string[];
  fileType?: string;
  size?: number;
  requirePin: boolean;
  pin?: string;
  requireGuestIdentity?: boolean;
  expiresAt: number | null;
  allowDownload: boolean;
  allowUploads?: boolean;
  includeSubtree?: boolean;
  viewCount: number;
  totalDurationSeconds?: number;
  lastViewedAt: number | null;
  createdAt: number;
  recipients?: RecipientShareLink[];
  folderSubfolders?: Array<{
    id: string;
    name: string;
    parentId: string | null;
  }>;
  folderFiles?: Array<{
    id: string;
    name: string;
    parentId?: string | null;
    url: string;
    thumbnailUrl?: string;
    pages?: string[];
    fileType?: string;
    size?: number;
  }>;
}

/**
 * Generate a cryptographically secure, URL-safe random share token (12 characters)
 */
export function generateShareToken(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let token = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const values = new Uint8Array(12);
    crypto.getRandomValues(values);
    for (let i = 0; i < 12; i++) {
      token += chars[values[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 12; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return token;
}

/**
 * Creates or updates a public share record in the global 'shared_links' Firestore collection.
 * This allows external guests to access the file/folder via /share/[token] without needing access to the space itself.
 */
export async function createOrUpdatePublicShare(
  spaceId: string,
  spaceTitle: string,
  item: FileShareItem,
  config: ShareLinkConfig,
  folderFiles?: FileShareItem[],
  options?: { businessCard?: BusinessCardShareData; spaceLogoUrl?: string; folderSubfolders?: Array<{ id: string; name: string; parentId: string | null }> }
): Promise<string> {
  const token = config.token || generateShareToken();
  const now = Date.now();

  const shareDocRef = doc(db, 'shared_links', token);

  // If businessCard / spaceLogoUrl were not passed directly, try to fetch from Space doc
  let businessCard = options?.businessCard;
  let spaceLogoUrl = options?.spaceLogoUrl;
  let spaceFeatures: string[] = [];

  if (spaceId) {
    try {
      const spaceSnap = await getDoc(doc(db, 'spaces', spaceId));
      if (spaceSnap.exists()) {
        const spaceData = spaceSnap.data();
        if (Array.isArray(spaceData?.features)) {
          spaceFeatures = spaceData.features;
        }
        const hasBusinessFeature = Array.isArray(spaceData?.features) && spaceData.features.includes('business_card');
        if (hasBusinessFeature) {
          if (!businessCard && spaceData?.settings?.businessCard) {
            businessCard = spaceData.settings.businessCard;
          }
          if (!spaceLogoUrl && spaceData?.logoUrl) {
            spaceLogoUrl = spaceData.logoUrl;
          }
        }
      }
    } catch (e) {
      // Non-blocking fallback
    }
  }

  const payload: PublicSharedData = {
    token,
    spaceId,
    spaceTitle: spaceTitle || 'מרחב משותף',
    spaceLogoUrl: spaceLogoUrl || undefined,
    features: spaceFeatures,
    businessCard: businessCard || undefined,
    itemId: item.id,
    itemType: item.type,
    name: item.name,
    url: item.url || '',
    thumbnailUrl: item.thumbnailUrl || (Array.isArray(item.pages) && item.pages.length > 0 ? item.pages[0] : (item.url && !item.url.includes('.pdf') ? item.url : undefined)),
    pages: item.pages || [],
    fileType: item.fileType || 'other',
    size: item.size || 0,
    requirePin: Boolean(config.requirePin),
    pin: config.requirePin && config.pin ? config.pin.trim() : '',
    requireGuestIdentity: config.requireGuestIdentity !== false,
    expiresAt: config.expiresAt || null,
    allowDownload: config.allowDownload !== false,
    allowUploads: config.allowUploads !== false,
    includeSubtree: Boolean(config.includeSubtree),
    viewCount: config.viewCount || 0,
    lastViewedAt: config.lastViewedAt || null,
    createdAt: config.createdAt || now,
    recipients: Array.isArray(config.recipients) ? config.recipients : []
  };

  if (item.type === 'folder') {
    payload.folderSubfolders = config.includeSubtree && options?.folderSubfolders ? options.folderSubfolders : [];
    if (folderFiles) {
      payload.folderFiles = folderFiles.map(f => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId || null,
        url: f.url || '',
        thumbnailUrl: f.thumbnailUrl || (Array.isArray(f.pages) && f.pages.length > 0 ? f.pages[0] : (f.url && !f.url.toLowerCase().includes('.pdf') ? f.url : undefined)),
        pages: f.pages || [],
        fileType: f.fileType || 'other',
        size: f.size || 0
      }));
    }
  }

  await setDoc(shareDocRef, sanitizeFirestoreData(payload), { merge: true });

  // If there are specific recipients, ensure their personal tokens are also stored/updated in shared_links
  if (Array.isArray(config.recipients)) {
    for (const r of config.recipients) {
      if (r.token) {
        const rDocRef = doc(db, 'shared_links', r.token);
        if (!r.enabled) {
          // If disabled/blocked, delete from shared_links
          await deleteDoc(rDocRef);
        } else {
          // Preserve existing live metrics from existing document if already present
          let currentViewCount = r.viewCount || 0;
          let currentDuration = r.totalDurationSeconds || 0;
          let currentLastViewed = r.lastViewedAt || null;

          try {
            const existingRSnap = await getDoc(rDocRef);
            if (existingRSnap.exists()) {
              const existingData = existingRSnap.data();
              if (typeof existingData.viewCount === 'number' && existingData.viewCount > currentViewCount) {
                currentViewCount = existingData.viewCount;
              }
              if (typeof existingData.totalDurationSeconds === 'number' && existingData.totalDurationSeconds > currentDuration) {
                currentDuration = existingData.totalDurationSeconds;
              }
              if (existingData.lastViewedAt) {
                currentLastViewed = existingData.lastViewedAt;
              }
            }
          } catch (_) {}

          const rPayload: PublicSharedData = {
            ...payload,
            token: r.token,
            recipientId: r.id,
            recipientName: r.recipientName,
            recipientRole: r.role || 'general',
            recipientPhone: r.phone || '',
            internalNote: r.internalNote || undefined,
            publicMessage: r.publicMessage || undefined,
            chatChannelId: r.chatChannelId || (`guest_${r.token}`),
            viewCount: currentViewCount,
            lastViewedAt: currentLastViewed,
            totalDurationSeconds: currentDuration,
            createdAt: r.createdAt || now
          };
          await setDoc(rDocRef, sanitizeFirestoreData(rPayload), { merge: true });
        }
      }
    }
  }

  return token;
}

/**
 * Retrieves public share data by token.
 */
export async function getPublicShare(token: string): Promise<PublicSharedData | null> {
  if (!token) return null;
  try {
    const snap = await getDoc(doc(db, 'shared_links', token));
    if (!snap.exists()) return null;
    return snap.data() as PublicSharedData;
  } catch (err) {
    console.error('Error fetching public share:', err);
    return null;
  }
}

/**
 * DRY Single Source of Truth: builds a direct WhatsApp URL.
 * When `phone` is provided, navigates straight into that recipient's WhatsApp chat
 * so the sender only has to tap "Send"!
 */
export function buildWhatsAppShareUrl(message: string, phone?: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 7) {
    let intlPhone = digits;
    if (intlPhone.startsWith('00')) {
      intlPhone = intlPhone.slice(2);
    } else if (intlPhone.startsWith('0')) {
      intlPhone = `972${intlPhone.slice(1)}`;
    }
    return `https://api.whatsapp.com/send?phone=${intlPhone}&text=${encodeURIComponent(message)}`;
  }
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}

/**
 * DRY Single Source of Truth: builds a 1-tap WhatsApp alert link to notify an external guest
 * that the space owner replied to their message on a shared file/folder.
 */
export function buildGuestReplyWhatsAppUrl(params: {
  phone?: string;
  guestName?: string;
  itemName?: string;
  shareToken?: string;
}): string | null {
  const digits = String(params.phone || '').replace(/\D/g, '');
  if (digits.length < 7) return null;
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://smart-share-tvwn-delta.vercel.app';
  const link = params.shareToken ? `${origin}/share/${params.shareToken}` : '';
  const namePart = params.guestName ? ` ${params.guestName}` : '';
  const itemPart = params.itemName ? ` לגבי "${params.itemName}"` : '';
  const text = `היי${namePart}, שלחתי לך תשובה${itemPart}.${link ? `\nלצפייה ומענה: ${link}` : ''}`;
  return buildWhatsAppShareUrl(text, params.phone);
}

/**
 * Detects automated link-preview crawlers (WhatsApp, Facebook, Instagram, Telegram, etc.)
 * so social link previews never create fake "views".
 */
export function isLinkPreviewBot(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /facebookexternalhit|Facebot|WhatsApp|Twitterbot|LinkedInBot|TelegramBot|Slackbot|Discordbot|Googlebot|bingbot|Applebot/i.test(ua);
}

/**
 * Silently detects traffic channel from User-Agent / document.referrer with ZERO work for the sender.
 */
export function detectAnonymousShareChannel(): string {
  if (typeof window === 'undefined') return 'קישור ישיר';
  const ua = (navigator.userAgent || '').toLowerCase();
  const ref = (document.referrer || '').toLowerCase();
  if (ua.includes('instagram') || ref.includes('instagram.com')) return 'אינסטגרם';
  if (ua.includes('fban') || ua.includes('fbav') || ref.includes('facebook.com') || ref.includes('fb.me')) return 'פייסבוק';
  if (ref.includes('whatsapp') || ref.includes('wa.me')) return 'וואטסאפ';
  if (ref.includes('mail.google') || ref.includes('outlook') || ref.includes('mail.yahoo')) return 'מייל';
  if (ref.includes('t.me') || ref.includes('telegram')) return 'טלגרם';
  return 'קישור ישיר';
}

/**
 * Registers or updates an anonymous guest who identified themselves (name + phone) on a general public link.
 * Deduplicates by normalized phone digits and syncs directly into the Share Wall's recipients list!
 */
const SHARE_VISIT_COOLDOWN_MS = 15 * 60 * 1000; // 15-minute session window (prevents page refreshes from inflating visit counts!)

/**
 * DRY Single-Source-of-Truth cooldown guard: returns true only if at least 15 minutes
 * have elapsed since this browser last counted a visit for this token/visitor.
 */
function shouldCountNewShareVisit(token: string, visitorKey = 'default'): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const key = `smartshare_visit_ts_${token}_${visitorKey}`;
    const lastTs = Number(localStorage.getItem(key) || '0');
    const now = Date.now();
    if (lastTs > 0 && now - lastTs < SHARE_VISIT_COOLDOWN_MS) {
      return false;
    }
    localStorage.setItem(key, String(now));
    return true;
  } catch {
    return true;
  }
}

export async function registerAnonymousGuestVisit(
  token: string,
  guest: { name: string; phone: string; profession?: string }
): Promise<{ recipientId: string; sourceChannel: string } | null> {
  if (!token || isLinkPreviewBot()) return null;
  const cleanName = String(guest.name || '').trim().slice(0, 60);
  const cleanPhone = String(guest.phone || '').trim().slice(0, 24);
  const cleanProfession = String(guest.profession || '').trim().slice(0, 48);
  const phoneDigits = cleanPhone.replace(/\D/g, '');
  if (cleanName.length < 2 || phoneDigits.length < 7) return null;

  const sourceChannel = detectAnonymousShareChannel();
  const now = Date.now();
  const countVisit = shouldCountNewShareVisit(token, `anon_${phoneDigits}`);

  try {
    const shareDocRef = doc(db, 'shared_links', token);
    const snap = await getDoc(shareDocRef);
    if (!snap.exists()) return null;
    const data = snap.data() as PublicSharedData;

    const existingList: RecipientShareLink[] = Array.isArray(data.recipients) ? [...data.recipients] : [];
    const matchIdx = existingList.findIndex(
      (r) => r.phone && r.phone.replace(/\D/g, '') === phoneDigits
    );

    let recipientId = '';
    if (matchIdx >= 0) {
      recipientId = existingList[matchIdx].id;
      existingList[matchIdx] = {
        ...existingList[matchIdx],
        recipientName: existingList[matchIdx].recipientName || cleanName,
        ...(cleanProfession ? { profession: cleanProfession } : {}),
        viewCount: (existingList[matchIdx].viewCount || 0) + (countVisit ? 1 : 0),
        lastViewedAt: now,
        sourceChannel: existingList[matchIdx].sourceChannel || sourceChannel,
      };
    } else {
      recipientId = `pub_${phoneDigits}_${now.toString(36).slice(-4)}`;
      existingList.unshift({
        id: recipientId,
        recipientName: cleanName,
        ...(cleanProfession ? { profession: cleanProfession } : {}),
        role: 'general',
        phone: cleanPhone,
        token,
        enabled: true,
        createdAt: now,
        viewCount: 1,
        totalDurationSeconds: 0,
        lastViewedAt: now,
        origin: 'public_link',
        sourceChannel,
        chatChannelId: `guest_${recipientId}`,
      });
    }

    await updateDoc(shareDocRef, sanitizeFirestoreData({
      ...(countVisit ? { viewCount: increment(1) } : {}),
      lastViewedAt: now,
      recipients: existingList,
    }));

    // Sync into Space's fileShareItems so the owner sees the contractor/visitor immediately in SharePeopleTab
    if (data.spaceId && data.itemId) {
      const spaceDocRef = doc(db, 'spaces', data.spaceId);
      const spaceSnap = await getDoc(spaceDocRef);
      if (spaceSnap.exists()) {
        const spaceData = spaceSnap.data();
        const items = Array.isArray(spaceData.fileShareItems) ? [...spaceData.fileShareItems] : [];
        const itemIdx = items.findIndex((i) => i.id === data.itemId);
        if (itemIdx >= 0) {
          const it = items[itemIdx];
          const shareLink = { ...(it.shareLink || {}) };
          const spaceRecipients: RecipientShareLink[] = Array.isArray(shareLink.recipients)
            ? [...shareLink.recipients]
            : [];
          const sMatchIdx = spaceRecipients.findIndex(
            (r) => r.id === recipientId || (r.phone && r.phone.replace(/\D/g, '') === phoneDigits)
          );
          if (sMatchIdx >= 0) {
            spaceRecipients[sMatchIdx] = {
              ...spaceRecipients[sMatchIdx],
              recipientName: spaceRecipients[sMatchIdx].recipientName || cleanName,
              viewCount: (spaceRecipients[sMatchIdx].viewCount || 0) + 1,
              lastViewedAt: now,
              sourceChannel: spaceRecipients[sMatchIdx].sourceChannel || sourceChannel,
            };
          } else {
            spaceRecipients.unshift({
              id: recipientId,
              recipientName: cleanName,
              role: 'general',
              phone: cleanPhone,
              token,
              enabled: true,
              createdAt: now,
              viewCount: 1,
              totalDurationSeconds: 0,
              lastViewedAt: now,
              origin: 'public_link',
              sourceChannel,
              chatChannelId: `guest_${recipientId}`,
            });
          }
          shareLink.recipients = spaceRecipients;
          shareLink.viewCount = (shareLink.viewCount || 0) + 1;
          shareLink.lastViewedAt = now;
          items[itemIdx] = { ...it, shareLink };
          await updateDoc(spaceDocRef, sanitizeFirestoreData({ fileShareItems: items }));
        }
      }
    }

    return { recipientId, sourceChannel };
  } catch (err) {
    console.warn('Failed to register anonymous guest visit:', err);
    return null;
  }
}

/**
 * Records an external guest view by incrementing viewCount and updating lastViewedAt.
 * Also synchronizes the view event into the space's fileShareItems array for owner visibility.
 */
export async function recordPublicShareView(token: string): Promise<void> {
  if (!token || isLinkPreviewBot()) return;
  // 15-minute session cooldown: page refreshes within 15 min do NOT inflate visit counts!
  if (!shouldCountNewShareVisit(token, 'view')) return;
  try {
    const shareDocRef = doc(db, 'shared_links', token);
    const snap = await getDoc(shareDocRef);
    if (!snap.exists()) return;
    const data = snap.data() as PublicSharedData;

    await updateDoc(shareDocRef, {
      viewCount: increment(1),
      lastViewedAt: Date.now()
    });

    // Synchronize to space if spaceId and itemId exist
    if (data.spaceId && data.itemId) {
      const spaceDocRef = doc(db, 'spaces', data.spaceId);
      const spaceSnap = await getDoc(spaceDocRef);
      if (spaceSnap.exists()) {
        const spaceData = spaceSnap.data();
        const items = Array.isArray(spaceData.fileShareItems) ? [...spaceData.fileShareItems] : [];
        const itemIdx = items.findIndex(i => i.id === data.itemId);
        if (itemIdx >= 0) {
          const it = items[itemIdx];
          const shareLink = { ...(it.shareLink || {}) };
          if (data.recipientId && Array.isArray(shareLink.recipients)) {
            shareLink.recipients = shareLink.recipients.map((r: RecipientShareLink) => {
              if (r.id === data.recipientId || r.token === token) {
                return {
                  ...r,
                  viewCount: (r.viewCount || 0) + 1,
                  lastViewedAt: Date.now()
                };
              }
              return r;
            });
          } else {
            shareLink.viewCount = (shareLink.viewCount || 0) + 1;
            shareLink.lastViewedAt = Date.now();
          }
          items[itemIdx] = { ...it, shareLink };
          await updateDoc(spaceDocRef, { fileShareItems: items });
        }
      }
    }
  } catch (err) {
    console.warn('Failed to record share view count:', err);
  }
}

/**
 * Records time spent on a shared link (heartbeat or on unload).
 */
export async function recordShareHeartbeat(token: string, durationSeconds: number, guestRecipientId?: string | null): Promise<void> {
  if (!token || durationSeconds <= 0 || isLinkPreviewBot()) return;
  try {
    const shareDocRef = doc(db, 'shared_links', token);
    const snap = await getDoc(shareDocRef);
    if (!snap.exists()) return;
    const data = snap.data() as PublicSharedData;
    const effectiveRecipientId = data.recipientId || guestRecipientId || null;

    await updateDoc(shareDocRef, {
      totalDurationSeconds: increment(durationSeconds)
    });

    if (data.spaceId && data.itemId) {
      const spaceDocRef = doc(db, 'spaces', data.spaceId);
      const spaceSnap = await getDoc(spaceDocRef);
      if (spaceSnap.exists()) {
        const spaceData = spaceSnap.data();
        const items = Array.isArray(spaceData.fileShareItems) ? [...spaceData.fileShareItems] : [];
        const itemIdx = items.findIndex(i => i.id === data.itemId);
        if (itemIdx >= 0) {
          const it = items[itemIdx];
          const shareLink = { ...(it.shareLink || {}) };
          if (effectiveRecipientId && Array.isArray(shareLink.recipients)) {
            shareLink.recipients = shareLink.recipients.map((r: RecipientShareLink) => {
              if (r.id === effectiveRecipientId || (!guestRecipientId && r.token === token)) {
                return {
                  ...r,
                  totalDurationSeconds: (r.totalDurationSeconds || 0) + durationSeconds
                };
              }
              return r;
            });
          } else {
            shareLink.totalDurationSeconds = (shareLink.totalDurationSeconds || 0) + durationSeconds;
          }
          items[itemIdx] = { ...it, shareLink };
          await updateDoc(spaceDocRef, { fileShareItems: items });
        }
      }
    }
  } catch (err) {
    console.warn('Failed to record share heartbeat duration:', err);
  }
}

/**
 * Revokes and deletes a public share token.
 */
export async function revokePublicShare(token: string): Promise<void> {
  if (!token) return;
  try {
    await deleteDoc(doc(db, 'shared_links', token));
  } catch (err) {
    console.error('Error revoking public share:', err);
  }
}

// Re-export single source of truth formatFileSize (Rule DRY / Single Source of Truth)
export { formatFileSize } from '@/utils/documentUtils';

/**
 * Checks if a share link has expired.
 */
export function isShareExpired(expiresAt: number | null): boolean {
  if (!expiresAt) return false;
  return Date.now() > expiresAt;
}

/**
 * Uploads a recipient submission (quote, contract, photo, document) from /share/[token]
 * and saves it into the Space's fileShareItems, automatically creating a designated folder
 * named after the recipient if it doesn't already exist.
 */
export async function uploadRecipientSubmission(
  token: string,
  fileData: {
    name: string;
    url: string;
    fileType: 'pdf' | 'image' | 'doc' | 'sheet' | 'other';
    size: number;
    pages?: string[];
  },
  note?: string,
  contactPhone?: string,
  overrideGuestName?: string,
  overrideGuestProfession?: string
): Promise<{ success: boolean; folderId?: string; fileId?: string; folderName?: string; spaceOwnerIds?: string[]; error?: string }> {
  try {
    const shareData = await getPublicShare(token);
    if (!shareData || !shareData.spaceId) {
      return { success: false, error: 'שיתוף לא נמצא או שפג תוקפו' };
    }

    const spaceDocRef = doc(db, 'spaces', shareData.spaceId);
    const spaceSnap = await getDoc(spaceDocRef);
    if (!spaceSnap.exists()) {
      return { success: false, error: 'המרחב אינו זמין' };
    }

    const spaceData = spaceSnap.data();
    const items: FileShareItem[] = Array.isArray(spaceData.fileShareItems) ? [...spaceData.fileShareItems] : [];

    // Determine recipient display title (use real identified guest name when available!)
    const recipientName = (overrideGuestName || shareData.recipientName || 'אורח קישור').trim();
    const roleHebrew = shareData.recipientRole === 'provider' ? 'ספק / קבלן' : (shareData.recipientRole === 'client' ? 'לקוח' : 'נמען');
    const folderName = `📥 ${recipientName} (${roleHebrew})`;

    // Check if recipient folder already exists in the space
    let targetFolder = items.find(i => i.type === 'folder' && (
      i.name === folderName || 
      i.name.startsWith(`📥 ${recipientName}`) ||
      (shareData.recipientId && i.id === `sub_folder_${shareData.recipientId}`)
    ));

    const now = Date.now();

    const effectivePhone = (contactPhone || shareData.recipientPhone || '').trim();
    const senderCard = {
      name: recipientName,
      ...(effectivePhone ? { phone: effectivePhone } : {}),
      ...(overrideGuestProfession ? { profession: overrideGuestProfession.trim() } : {}),
      roleLabel: roleHebrew,
      ...(shareData.chatChannelId ? { chatChannelId: shareData.chatChannelId } : {}),
    };

    if (!targetFolder) {
      targetFolder = {
        id: shareData.recipientId ? `sub_folder_${shareData.recipientId}` : `folder_sub_${now}`,
        spaceId: shareData.spaceId,
        name: folderName,
        type: 'folder',
        parentId: null, // Root level folder in fileshare
        createdAt: now,
        createdBy: `guest_${shareData.recipientId || 'external'}`,
        creatorName: `${recipientName} (${effectivePhone || 'הגשה חיצונית'})`,
        allowedPartners: [], // open to space members
        senderContactCard: senderCard,
      };
      items.push(targetFolder);
    } else if (!targetFolder.senderContactCard || (!targetFolder.senderContactCard.phone && effectivePhone)) {
      targetFolder.senderContactCard = {
        ...(targetFolder.senderContactCard || { name: recipientName }),
        ...senderCard,
      };
    }

    // Create the uploaded file item
    const newFileItem: FileShareItem = {
      id: `file_sub_${now}_${Math.random().toString(36).substring(2, 6)}`,
      spaceId: shareData.spaceId,
      name: fileData.name,
      type: 'file',
      parentId: targetFolder.id,
      url: fileData.url,
      thumbnailUrl: fileData.pages && fileData.pages.length > 0 ? fileData.pages[0] : (fileData.url && !fileData.url.includes('.pdf') ? fileData.url : undefined),
      pages: fileData.pages || [fileData.url],
      fileType: fileData.fileType,
      size: fileData.size,
      createdAt: now,
      createdBy: `guest_${shareData.recipientId || 'external'}`,
      creatorName: `${recipientName} ${contactPhone ? `[📞 ${contactPhone}]` : ''} ${note ? `• "${note}"` : ''}`.trim(),
      allowedPartners: []
    };

    items.push(newFileItem);

    // Save updated items back to the space
    await updateDoc(spaceDocRef, { fileShareItems: items });

    // Sync the folder's shared_links so recipient sees their new file immediately
    if (targetFolder.shareLink?.token && shareData.spaceId) {
      await syncPublicFolderShares(shareData.spaceId, targetFolder.id, items);
    }

    const ownerIds = new Set<string>();
    if (spaceData.creatorId) ownerIds.add(String(spaceData.creatorId));
    if (Array.isArray(spaceData.members)) {
      spaceData.members.forEach((m: any) => {
        if (m?.id && (m.role === 'creator' || m.role === 'admin')) ownerIds.add(String(m.id));
      });
    }

    return {
      success: true,
      folderId: targetFolder.id,
      fileId: newFileItem.id,
      folderName,
      spaceOwnerIds: Array.from(ownerIds),
    };
  } catch (err: any) {
    console.error('Failed to upload recipient submission:', err);
    return { success: false, error: err.message || 'שגיאה בשמירת הקובץ' };
  }
}

/**
 * Automatically synchronizes public share records for a folder when files inside it change.
 */
export async function syncPublicFolderShares(
  spaceId: string,
  folderId: string,
  allItems: FileShareItem[]
): Promise<void> {
  try {
    const folder = allItems.find(i => i.id === folderId && i.type === 'folder');
    if (!folder || !folder.shareLink?.token) return;

    const includeSubtree = Boolean(folder.shareLink.includeSubtree);
    let targetFolderIds = new Set<string>([folderId]);
    const collectedSubfolders: Array<{ id: string; name: string; parentId: string | null }> = [];

    if (includeSubtree) {
      const collectDescendants = (parentId: string) => {
        const children = allItems.filter(i => i.type === 'folder' && i.parentId === parentId && !i.deletedAt);
        children.forEach(c => {
          if (!targetFolderIds.has(c.id)) {
            targetFolderIds.add(c.id);
            collectedSubfolders.push({ id: c.id, name: c.name, parentId: c.parentId });
            collectDescendants(c.id);
          }
        });
      };
      collectDescendants(folderId);
    }

    const folderFiles = allItems.filter(i => i.type === 'file' && i.parentId && targetFolderIds.has(i.parentId) && !i.deletedAt);
    const mappedFiles = folderFiles.map(f => ({
      id: f.id,
      name: f.name,
      parentId: f.parentId || null,
      url: f.url || '',
      thumbnailUrl: f.thumbnailUrl || (Array.isArray(f.pages) && f.pages.length > 0 ? f.pages[0] : (f.url && !f.url.toLowerCase().includes('.pdf') ? f.url : undefined)),
      pages: f.pages || [],
      fileType: f.fileType || 'other',
      size: f.size || 0
    }));

    // 1. Update master folder token
    const masterDocRef = doc(db, 'shared_links', folder.shareLink.token);
    
    // Optional branding enrichment if available and feature enabled
    let brandingUpdates: any = {
      folderFiles: mappedFiles,
      folderSubfolders: collectedSubfolders,
      includeSubtree
    };
    try {
      if (spaceId) {
        const spaceSnap = await getDoc(doc(db, 'spaces', spaceId));
        if (spaceSnap.exists()) {
          const sData = spaceSnap.data();
          const hasBusinessFeature = Array.isArray(sData?.features) && sData.features.includes('business_card');
          if (hasBusinessFeature) {
            if (sData?.settings?.businessCard) brandingUpdates.businessCard = sData.settings.businessCard;
            if (sData?.logoUrl) brandingUpdates.spaceLogoUrl = sData.logoUrl;
          }
        }
      }
    } catch (_) {}

    await updateDoc(masterDocRef, brandingUpdates).catch(() => {});

    // 2. Update all recipient tokens for this folder
    if (Array.isArray(folder.shareLink.recipients)) {
      for (const r of folder.shareLink.recipients) {
        if (r.token && r.enabled !== false) {
          const rDocRef = doc(db, 'shared_links', r.token);
          await updateDoc(rDocRef, brandingUpdates).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn('Failed to sync public folder shares:', err);
  }
}

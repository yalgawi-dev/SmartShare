'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/app/context/AuthContext';
import { useSpaces } from '@/app/context/SpacesContext';
import { getSharedContactsForUser } from '@/utils/partnerUtils';
import {
  FileShareItem,
  ShareLinkConfig,
  RecipientShareLink,
  RecipientRole,
  createOrUpdatePublicShare,
  revokePublicShare,
  generateShareToken,
  sanitizeFirestoreData,
} from '@/utils/fileShareUtils';
import { RegisteredMemberPickerModal, SelectableMember } from './RegisteredMemberPickerModal';
import {
  loadSavedShareDirectory,
  upsertSavedContact,
  type SavedShareContact,
  type SavedShareDirectory,
  type SavedShareGroup,
} from '@/utils/shareContactsStore';
import { APP_VERSION } from '@/constants/version';
import { SharePeopleTab } from './SharePeopleTab';
import { ShareQuickLinkTab } from './ShareQuickLinkTab';
import { ShareSecuritySettingsTab } from './ShareSecuritySettingsTab';

interface CreateShareLinkModalProps {
  isOpen: boolean;
  item: FileShareItem | null;
  space?: any;
  spaceTitle: string;
  folderFiles?: FileShareItem[];
  allSpaceFolders?: Array<{ id: string; name: string; parentId: string | null }>;
  allSpaceFiles?: FileShareItem[];
  spaceLogoUrl?: string;
  businessCard?: any;
  onClose: () => void;
  onSaved: (updatedLinkConfig?: ShareLinkConfig) => void;
}

type ModalTab = 'people' | 'link' | 'settings';

const EXPIRY_LABELS: Record<'never' | '1day' | '7days' | '30days', string> = {
  never: 'ללא תוקף',
  '1day': 'תוקף 24 שעות',
  '7days': 'תוקף 7 ימים',
  '30days': 'תוקף 30 יום',
};

export function CreateShareLinkModal({
  isOpen,
  item,
  space,
  spaceTitle,
  folderFiles,
  allSpaceFolders,
  allSpaceFiles,
  spaceLogoUrl,
  businessCard,
  onClose,
  onSaved,
}: CreateShareLinkModalProps) {
  const { user } = useAuth();
  const { spaces } = useSpaces();

  const [activeTab, setActiveTab] = useState<ModalTab>('people');
  const [isEnabled, setIsEnabled] = useState(true);
  const [requirePin, setRequirePin] = useState(false);
  const [pin, setPin] = useState('');
  const [expiryOption, setExpiryOption] = useState<'never' | '1day' | '7days' | '30days'>('never');
  const [allowDownload, setAllowDownload] = useState(true);
  const [allowUploads, setAllowUploads] = useState(true);
  const [includeSubtree, setIncludeSubtree] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState<string>('');

  const [recipients, setRecipients] = useState<RecipientShareLink[]>([]);
  const [newRecipientName, setNewRecipientName] = useState('');
  const [newRecipientRole, setNewRecipientRole] = useState<RecipientRole>('client');
  const [newRecipientPhone, setNewRecipientPhone] = useState('');
  const [newRecipientInternalNote, setNewRecipientInternalNote] = useState('');
  const [newRecipientPublicMessage, setNewRecipientPublicMessage] = useState('');
  const [showNoteFields, setShowNoteFields] = useState(false);
  const [copiedRecipientId, setCopiedRecipientId] = useState<string | null>(null);
  const [supportsContactPicker, setSupportsContactPicker] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isMemberPickerOpen, setIsMemberPickerOpen] = useState(false);
  const [editingRecipientId, setEditingRecipientId] = useState<string | null>(null);
  const [editInternalNote, setEditInternalNote] = useState('');
  const [editPublicMessage, setEditPublicMessage] = useState('');
  const [savedDirectory, setSavedDirectory] = useState<SavedShareDirectory>({ contacts: [], groups: [], updatedAt: 0 });
  const [quickPickPanel, setQuickPickPanel] = useState<'none' | 'contacts' | 'groups'>('none');

  useEffect(() => {
    if (!isOpen || !user?.id) return;
    loadSavedShareDirectory(user.id).then(setSavedDirectory).catch(() => {});
  }, [isOpen, user?.id]);

  const registeredMembers: SelectableMember[] = useMemo(() => {
    const list: SelectableMember[] = [];
    const seenKeys = new Set<string>();

    if (space && Array.isArray(space.members)) {
      space.members.forEach((m: any) => {
        const key = m.phone || m.userId || m.name;
        if (key && !seenKeys.has(key)) {
          seenKeys.add(key);
          list.push({
            id: m.userId || key,
            name: m.name || 'חבר מרחב',
            phone: m.phone || '',
            avatarUrl: m.avatarUrl,
            role: m.role === 'creator' || m.role === 'admin' ? 'מנהל' : 'שותף',
            info: space.title,
          });
        }
      });
    }

    if (space && Array.isArray(space.pendingGroupMembers)) {
      space.pendingGroupMembers.forEach((pm: any) => {
        const key = pm.phone || pm.id || pm.name;
        if (key && !seenKeys.has(key)) {
          seenKeys.add(key);
          list.push({
            id: pm.id || key,
            name: pm.name,
            phone: pm.phone || '',
            avatarUrl: pm.avatarUrl,
            role: 'חבר מרחב',
            info: space.title,
          });
        }
      });
    }

    try {
      const sharedContacts = getSharedContactsForUser(user, spaces);
      sharedContacts.forEach((sc) => {
        const key = sc.phone || sc.id || sc.name;
        if (key && !seenKeys.has(key)) {
          seenKeys.add(key);
          list.push({
            id: sc.id || key,
            name: sc.name,
            phone: sc.phone || '',
            avatarUrl: sc.avatarUrl,
            role: 'איש קשר רשום',
            info: sc.spaces?.[0]?.title || '',
          });
        }
      });
    } catch (_) {}

    return list;
  }, [space, spaces, user]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
      setSupportsContactPicker(true);
    }
  }, []);

  const generateRandomPin = () => String(Math.floor(1000 + Math.random() * 9000));

  useEffect(() => {
    if (isOpen && item) {
      let isMounted = true;
      setActiveTab('people');
      const link = item.shareLink;
      if (link && (link.token || (Array.isArray(link.recipients) && link.recipients.length > 0))) {
        setIsEnabled(link.enabled !== false);
        const activeToken = link.token || generateShareToken();
        setToken(activeToken);
        setRequirePin(Boolean(link.requirePin));
        setPin(link.pin || '');
        setAllowDownload(link.allowDownload !== false);
        setAllowUploads(link.allowUploads !== false);
        setIncludeSubtree(Boolean(link.includeSubtree));
        setRecipients(Array.isArray(link.recipients) ? link.recipients : []);

        if (!link.expiresAt) {
          setExpiryOption('never');
        } else {
          const diffDays = Math.round((link.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 1) setExpiryOption('1day');
          else if (diffDays <= 7) setExpiryOption('7days');
          else setExpiryOption('30days');
        }

        if (link.token) {
          getDoc(doc(db, 'shared_links', link.token))
            .then(async (snap) => {
              if (snap.exists() && isMounted) {
                const data = snap.data();
                let canonicalRecipients = Array.isArray(data.recipients) ? data.recipients : [];
                if (canonicalRecipients.length > 0) {
                  canonicalRecipients = await Promise.all(
                    canonicalRecipients.map(async (r: RecipientShareLink) => {
                      if (!r.token) return r;
                      try {
                        const rSnap = await getDoc(doc(db, 'shared_links', r.token));
                        if (rSnap.exists()) {
                          const rData = rSnap.data();
                          return {
                            ...r,
                            viewCount: rData.viewCount !== undefined ? rData.viewCount : r.viewCount,
                            totalDurationSeconds: rData.totalDurationSeconds !== undefined ? rData.totalDurationSeconds : r.totalDurationSeconds,
                            lastViewedAt: rData.lastViewedAt !== undefined ? rData.lastViewedAt : r.lastViewedAt,
                          };
                        }
                      } catch (_) {}
                      return r;
                    })
                  );
                }
                if (canonicalRecipients.length > 0 && isMounted) {
                  setRecipients(canonicalRecipients);
                  if (item.shareLink) item.shareLink.recipients = canonicalRecipients;
                }
              }
            })
            .catch(() => {});
        }
      } else {
        setIsEnabled(true);
        setToken(generateShareToken());
        setRequirePin(false);
        setPin('');
        setExpiryOption('never');
        setAllowDownload(true);
        setAllowUploads(true);
        setIncludeSubtree(false);
        setRecipients([]);
      }
      setCopied(false);
      setNewRecipientName('');
      setNewRecipientPhone('');
      setNewRecipientRole('client');
      setShowNoteFields(false);
      setQuickPickPanel('none');
      setEditingRecipientId(null);
      setSaveSuccessMsg(null);

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, item?.id]);

  const { effectiveFolderFiles, effectiveSubfolders } = useMemo(() => {
    if (!item || item.type !== 'folder') {
      return { effectiveFolderFiles: folderFiles || [], effectiveSubfolders: [] };
    }
    if (!includeSubtree || !allSpaceFolders || !allSpaceFiles) {
      return { effectiveFolderFiles: folderFiles || [], effectiveSubfolders: [] };
    }
    const targetFolderIds = new Set<string>([item.id]);
    const subs: Array<{ id: string; name: string; parentId: string | null }> = [];
    const collect = (parentId: string) => {
      allSpaceFolders
        .filter((f) => f.parentId === parentId)
        .forEach((c) => {
          if (!targetFolderIds.has(c.id)) {
            targetFolderIds.add(c.id);
            subs.push({ id: c.id, name: c.name, parentId: c.parentId });
            collect(c.id);
          }
        });
    };
    collect(item.id);
    const files = allSpaceFiles.filter((f) => f.parentId && targetFolderIds.has(f.parentId));
    return { effectiveFolderFiles: files, effectiveSubfolders: subs };
  }, [item, includeSubtree, folderFiles, allSpaceFolders, allSpaceFiles]);

  if (!isOpen || !item) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://smart-share-tvwn-delta.vercel.app';
  const shareUrl = token ? `${currentOrigin}/share/${token}` : '';

  const calculateExpiryTimestamp = (opt: string): number | null => {
    const now = Date.now();
    if (opt === '1day') return now + 1 * 24 * 60 * 60 * 1000;
    if (opt === '7days') return now + 7 * 24 * 60 * 60 * 1000;
    if (opt === '30days') return now + 30 * 24 * 60 * 60 * 1000;
    return null;
  };

  const getSenderDisplay = () => {
    const senderPersonName = user?.realName || user?.nickname || (user as any)?.displayName || businessCard?.contactName;
    return senderPersonName
      ? `${senderPersonName}${businessCard?.businessName ? ` (${businessCard.businessName})` : spaceTitle ? ` ממרחב "${spaceTitle}"` : ''}`
      : businessCard?.businessName || spaceTitle || 'חבר';
  };

  const ensurePersisted = async (
    tokenToUse: string,
    updatedRecipients?: RecipientShareLink[],
    overrideSubtree?: boolean
  ): Promise<boolean> => {
    if (!item) return false;
    try {
      const expiresAt = calculateExpiryTimestamp(expiryOption);
      const activeRecipients = updatedRecipients !== undefined ? updatedRecipients : recipients;
      const activeSubtree = overrideSubtree !== undefined ? overrideSubtree : includeSubtree;

      let filesToSave = effectiveFolderFiles;
      let subsToSave = effectiveSubfolders;
      if (item.type === 'folder' && overrideSubtree !== undefined && allSpaceFolders && allSpaceFiles) {
        if (!activeSubtree) {
          filesToSave = folderFiles || [];
          subsToSave = [];
        } else {
          const targetIds = new Set<string>([item.id]);
          const s: Array<{ id: string; name: string; parentId: string | null }> = [];
          const collect = (pId: string) => {
            allSpaceFolders
              .filter((f) => f.parentId === pId)
              .forEach((c) => {
                if (!targetIds.has(c.id)) {
                  targetIds.add(c.id);
                  s.push({ id: c.id, name: c.name, parentId: c.parentId });
                  collect(c.id);
                }
              });
          };
          collect(item.id);
          filesToSave = allSpaceFiles.filter((f) => f.parentId && targetIds.has(f.parentId));
          subsToSave = s;
        }
      }

      const newConfig: ShareLinkConfig = {
        enabled: true,
        token: tokenToUse,
        requirePin,
        pin: requirePin && pin ? pin.trim() : '',
        expiresAt,
        allowDownload,
        allowUploads,
        includeSubtree: activeSubtree,
        viewCount: item.shareLink?.viewCount || 0,
        totalDurationSeconds: item.shareLink?.totalDurationSeconds || 0,
        lastViewedAt: item.shareLink?.lastViewedAt || null,
        createdAt: item.shareLink?.createdAt || Date.now(),
        recipients: activeRecipients,
      };

      await createOrUpdatePublicShare(item.spaceId, spaceTitle, item, newConfig, filesToSave, {
        businessCard,
        spaceLogoUrl,
        folderSubfolders: subsToSave,
      });

      if (item.spaceId) {
        try {
          const spaceDocRef = doc(db, 'spaces', item.spaceId);
          const spaceSnap = await getDoc(spaceDocRef);
          if (spaceSnap.exists()) {
            const currentItems = Array.isArray(spaceSnap.data().fileShareItems) ? [...spaceSnap.data().fileShareItems] : [];
            const idx = currentItems.findIndex((i: any) => i.id === item.id);
            if (idx >= 0) {
              currentItems[idx] = { ...currentItems[idx], shareLink: newConfig };
            } else {
              currentItems.push({ ...item, shareLink: newConfig });
            }
            await updateDoc(spaceDocRef, sanitizeFirestoreData({ fileShareItems: currentItems }));
          }
        } catch (dbErr) {
          console.warn('Direct space update failed, falling back to onSaved:', dbErr);
        }
      }

      item.shareLink = newConfig;
      onSaved(newConfig);
      return true;
    } catch (err) {
      console.error('Failed to auto-persist share link:', err);
      return false;
    }
  };

  const handleAddSavedContact = async (contact: SavedShareContact) => {
    const exists = recipients.some(
      (r) =>
        r.recipientName.trim().toLowerCase() === contact.name.trim().toLowerCase() ||
        (contact.phone && r.phone && r.phone.replace(/\D/g, '') === contact.phone.replace(/\D/g, ''))
    );
    if (exists) {
      setQuickPickPanel('none');
      return;
    }
    if (!isEnabled) setIsEnabled(true);
    const recipientToken = generateShareToken();
    const newRecipient: RecipientShareLink = {
      id: `rcp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recipientName: contact.name.trim(),
      role: contact.role || newRecipientRole,
      phone: contact.phone || '',
      token: recipientToken,
      enabled: true,
      createdAt: Date.now(),
      viewCount: 0,
      totalDurationSeconds: 0,
      lastViewedAt: null,
      chatChannelId: `guest_${recipientToken}`,
    };
    const nextRecipients = [...recipients, newRecipient];
    setRecipients(nextRecipients);
    setQuickPickPanel('none');
    if (token) await ensurePersisted(token, nextRecipients);
  };

  const handleAddSavedGroup = async (group: SavedShareGroup) => {
    const members = group.contactIds
      .map((id) => savedDirectory.contacts.find((c) => c.id === id))
      .filter((c): c is SavedShareContact => Boolean(c));
    if (members.length === 0) return;

    const toAdd: RecipientShareLink[] = [];
    for (const c of members) {
      const exists = recipients.some(
        (r) =>
          r.recipientName.trim().toLowerCase() === c.name.trim().toLowerCase() ||
          (c.phone && r.phone && r.phone.replace(/\D/g, '') === c.phone.replace(/\D/g, ''))
      );
      if (exists) continue;
      const recipientToken = generateShareToken();
      toAdd.push({
        id: `rcp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${toAdd.length}`,
        recipientName: c.name.trim(),
        role: c.role || newRecipientRole,
        phone: c.phone || '',
        token: recipientToken,
        enabled: true,
        createdAt: Date.now(),
        viewCount: 0,
        totalDurationSeconds: 0,
        lastViewedAt: null,
        chatChannelId: `guest_${recipientToken}`,
      });
    }
    setQuickPickPanel('none');
    if (toAdd.length === 0) return;
    if (!isEnabled) setIsEnabled(true);
    const nextRecipients = [...recipients, ...toAdd];
    setRecipients(nextRecipients);
    if (token) await ensurePersisted(token, nextRecipients);
  };

  const handleAddRecipient = async () => {
    if (!newRecipientName.trim()) return;
    if (!isEnabled) setIsEnabled(true);
    const recipientToken = generateShareToken();
    const phoneVal = newRecipientPhone.trim();
    const cleanName = newRecipientName.trim();
    const newRecipient: RecipientShareLink = {
      id: `rcp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recipientName: cleanName,
      role: newRecipientRole,
      phone: phoneVal || '',
      token: recipientToken,
      enabled: true,
      createdAt: Date.now(),
      viewCount: 0,
      totalDurationSeconds: 0,
      lastViewedAt: null,
      internalNote: newRecipientInternalNote.trim() || undefined,
      publicMessage: newRecipientPublicMessage.trim() || undefined,
      chatChannelId: `guest_${recipientToken}`,
    };

    const nextRecipients = [...recipients, newRecipient];
    setRecipients(nextRecipients);
    setNewRecipientName('');
    setNewRecipientPhone('');
    setNewRecipientInternalNote('');
    setNewRecipientPublicMessage('');
    setShowNoteFields(false);

    if (user?.id) {
      upsertSavedContact(user.id, { name: cleanName, phone: phoneVal || undefined, role: newRecipientRole })
        .then(setSavedDirectory)
        .catch(() => {});
    }
    if (token) await ensurePersisted(token, nextRecipients);
  };

  const handleToggleRecipientBlock = async (recId: string) => {
    const nextRecipients = recipients.map((r) => (r.id === recId ? { ...r, enabled: !r.enabled } : r));
    setRecipients(nextRecipients);
    if (token) await ensurePersisted(token, nextRecipients);
  };

  const handleRemoveRecipient = async (recId: string) => {
    const target = recipients.find((r) => r.id === recId);
    if (target?.token) await revokePublicShare(target.token);
    const nextRecipients = recipients.filter((r) => r.id !== recId);
    setRecipients(nextRecipients);
    if (token) await ensurePersisted(token, nextRecipients);
  };

  const handleSaveRecipientNotes = async (recId: string) => {
    const nextRecipients = recipients.map((r) =>
      r.id === recId
        ? { ...r, internalNote: editInternalNote.trim() || undefined, publicMessage: editPublicMessage.trim() || undefined }
        : r
    );
    setRecipients(nextRecipients);
    setEditingRecipientId(null);
    if (token) await ensurePersisted(token, nextRecipients);
  };

  const handleStartEditRecipient = (r: RecipientShareLink) => {
    setEditingRecipientId(r.id);
    setEditInternalNote(r.internalNote || '');
    setEditPublicMessage(r.publicMessage || '');
  };

  const handlePickFromContacts = async () => {
    try {
      if ('contacts' in navigator && 'ContactsManager' in window) {
        const contacts = await (navigator as any).contacts.select(['name', 'tel'], { multiple: false });
        if (contacts && contacts.length > 0) {
          const c = contacts[0];
          if (c.name?.[0]) setNewRecipientName(c.name[0]);
          if (c.tel?.[0]) setNewRecipientPhone(c.tel[0].replace(/[^\d+]/g, ''));
        }
      } else {
        alert('התכונה "בחירה מאנשי קשר" נתמכת ישירות במכשיר הנייד (Chrome / Android PWA).');
      }
    } catch (_) {}
  };

  const copyTextSafe = async (txt: string) => {
    try {
      await navigator.clipboard.writeText(txt);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = txt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  const handleCopyRecipientLink = async (r: RecipientShareLink) => {
    const url = `${currentOrigin}/share/${r.token}`;
    const itemTypeHeb = item.type === 'folder' ? 'תיקיית' : 'מסמך';
    const pinText = requirePin && pin ? `\n🔐 קוד גישה: ${pin}` : '';
    const richMessage = `שלום ${r.recipientName},\n${getSenderDisplay()} שיתף איתך ${itemTypeHeb} "${item.name}" באפליקציית MySpace.${pinText}\nלצפייה מאובטחת והעלאת קבצים לחץ כאן:\n${url}`;
    await copyTextSafe(richMessage);
    setCopiedRecipientId(r.id);
    setTimeout(() => setCopiedRecipientId(null), 2500);
  };

  const handleWhatsAppRecipient = (r: RecipientShareLink) => {
    const url = `${currentOrigin}/share/${r.token}`;
    const itemTypeHeb = item.type === 'folder' ? 'תיקיית' : 'מסמך';
    const pinText = requirePin && pin ? `\n🔐 קוד גישה: ${pin}` : '';
    const slogan = businessCard?.slogan ? `\n✨ ${businessCard.slogan}` : '';
    const phone = businessCard?.phone || businessCard?.whatsapp;
    const phoneText = phone ? `\n📞 ליצירת קשר: ${phone}` : '';
    const portfolioText = businessCard?.portfolioUrl ? `\n🎨 לתיק עבודות: ${businessCard.portfolioUrl}` : '';
    const text = encodeURIComponent(
      `שלום ${r.recipientName},\n${getSenderDisplay()} שיתף איתך ${itemTypeHeb} "${item.name}":${pinText}\n${url}\n${slogan}${phoneText}${portfolioText}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    if (token) await ensurePersisted(token);
    const itemTypeHeb = item.type === 'folder' ? 'תיקיית' : 'מסמך';
    const pinText = requirePin && pin ? `\n🔐 קוד גישה: ${pin}` : '';
    const richMessage = `שלום,\n${getSenderDisplay()} שיתף איתך ${itemTypeHeb} "${item.name}" באפליקציית MySpace.${pinText}\nלצפייה מאובטחת והעלאת קבצים לחץ כאן:\n${shareUrl}`;
    await copyTextSafe(richMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = async () => {
    if (!shareUrl) return;
    if (token) await ensurePersisted(token);
    const itemTypeHeb = item.type === 'folder' ? 'תיקיית' : 'מסמך';
    const pinText = requirePin && pin ? `\n🔐 קוד גישה: ${pin}` : '';
    const slogan = businessCard?.slogan ? `\n✨ ${businessCard.slogan}` : '';
    const phone = businessCard?.phone || businessCard?.whatsapp;
    const phoneText = phone ? `\n📞 ליצירת קשר: ${phone}` : '';
    const portfolioText = businessCard?.portfolioUrl ? `\n🎨 לתיק עבודות: ${businessCard.portfolioUrl}` : '';
    const text = encodeURIComponent(
      `שלום,\n${getSenderDisplay()} שיתף איתך ${itemTypeHeb} "${item.name}":${pinText}\n${shareUrl}\n${slogan}${phoneText}${portfolioText}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleEmailShare = async () => {
    if (!shareUrl) return;
    if (token) await ensurePersisted(token);
    const itemTypeHeb = item.type === 'folder' ? 'תיקייה' : 'מסמך';
    const pinText = requirePin && pin ? `\nקוד גישה סודי: ${pin}` : '';
    const subject = encodeURIComponent(`שיתוף ${itemTypeHeb}: ${item.name} מתוך ${spaceTitle}`);
    const body = encodeURIComponent(
      `שלום,\n\nמצורף קישור לצפייה ב${itemTypeHeb} "${item.name}" מתוך ${spaceTitle}:${pinText}\n\nלצפייה ישירה לחץ על הקישור הבא:\n${shareUrl}\n\nבברכה`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (!shareUrl) return;
    if (token) await ensurePersisted(token);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        const itemTypeHeb = item.type === 'folder' ? 'תיקייה' : 'מסמך';
        await navigator.share({
          title: `${itemTypeHeb}: ${item.name}`,
          text: `קישור לצפייה ב${itemTypeHeb} "${item.name}" מתוך ${spaceTitle}${requirePin && pin ? ` (קוד גישה: ${pin})` : ''}`,
          url: shareUrl,
        });
      } catch (_) {}
    } else {
      handleCopy();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!isEnabled) {
        if (token) await revokePublicShare(token);
        for (const r of recipients) {
          if (r.token) await revokePublicShare(r.token);
        }
        onSaved(undefined);
        onClose();
        return;
      }
      if (requirePin && (!pin || pin.trim().length < 4)) {
        alert('אנא הזן קוד PIN בעל 4 ספרות לפחות להגנה על הקישור.');
        setActiveTab('settings');
        setIsSaving(false);
        return;
      }
      const activeToken = token || generateShareToken();
      const ok = await ensurePersisted(activeToken, recipients);
      if (ok) {
        setSaveSuccessMsg('הגדרות השיתוף נשמרו בהצלחה!');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('smartshare:fileshare_saved', { detail: { message: 'הגדרות השיתוף נשמרו בהצלחה!' } }));
        }
        setTimeout(() => {
          setIsSaving(false);
          onClose();
        }, 700);
        return;
      }
      alert('שגיאה בשמירת קישור השיתוף לשרת. אנא נסה שוב.');
    } catch (err) {
      console.error('Error saving share link:', err);
      alert('שגיאה ביצירת קישור השיתוף. אנא נסה שוב.');
    } finally {
      setIsSaving(false);
    }
  };

  const directFilesCount = folderFiles ? folderFiles.length : 0;
  const scopeSummaryText =
    item.type === 'folder'
      ? includeSubtree
        ? `כולל תתי-תיקיות (${effectiveSubfolders.length} תיקיות • ${effectiveFolderFiles.length} קבצים)`
        : `תיקייה זו בלבד (${directFilesCount} קבצים)`
      : `קובץ זה בלבד (${item.name})`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(8px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.65rem',
        direction: 'rtl',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-primary, #ffffff)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '470px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(15,23,42,0.35)',
          border: '1px solid var(--border-color)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact 2-Line Header + Clickable Live Status Pills */}
        <div
          style={{
            padding: '0.85rem 1rem 0.7rem',
            borderBottom: '1px solid var(--border-color)',
            background: 'linear-gradient(135deg, rgba(79,70,229,0.06), rgba(37,99,235,0.03))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{item.type === 'folder' ? '📁' : '📄'}</span>
              <div style={{ minWidth: 0 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '0.98rem',
                    fontWeight: 900,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  שיתוף: {item.name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      color: isEnabled ? '#047857' : '#dc2626',
                    }}
                  >
                    {isEnabled ? `🟢 פעיל${recipients.length > 0 ? ` • ${recipients.length} נמענים` : ''}` : '🔴 כבוי'}
                  </span>
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', opacity: 0.7 }}>{APP_VERSION}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="סגור"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '999px',
                border: '1px solid var(--border-color)',
                background: '#fff',
                color: 'var(--text-primary)',
                fontWeight: 800,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>

          {/* Read-Only Live Summary Badges (Display Only — Settings live in the Settings tab) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            <span
              style={{
                padding: '0.2rem 0.55rem',
                borderRadius: '999px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#475569',
                fontSize: '0.7rem',
                fontWeight: 700,
                userSelect: 'none',
              }}
            >
              📦 {item.type === 'folder' ? (includeSubtree ? `כולל תתי-תיקיות (${effectiveFolderFiles.length})` : `${directFilesCount} קבצים`) : 'קובץ בודד'}
            </span>
            <span
              style={{
                padding: '0.2rem 0.55rem',
                borderRadius: '999px',
                border: requirePin ? '1px solid #fcd34d' : '1px solid #e2e8f0',
                background: requirePin ? '#fffbeb' : '#f8fafc',
                color: requirePin ? '#b45309' : '#475569',
                fontSize: '0.7rem',
                fontWeight: 700,
                userSelect: 'none',
              }}
            >
              {requirePin ? `🔐 PIN: ${pin || '----'}` : '🔓 ללא PIN'}
            </span>
            <span
              style={{
                padding: '0.2rem 0.55rem',
                borderRadius: '999px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#475569',
                fontSize: '0.7rem',
                fontWeight: 700,
                userSelect: 'none',
              }}
            >
              ⏳ {EXPIRY_LABELS[expiryOption]}
            </span>
          </div>

          {/* 3-Tab Segmented Control */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '0.25rem',
              padding: '0.25rem',
              borderRadius: '12px',
              background: 'rgba(15,23,42,0.06)',
              marginTop: '0.15rem',
            }}
          >
            {(
              [
                { id: 'people', label: `👥 אנשים${recipients.length > 0 ? ` (${recipients.length})` : ''}` },
                { id: 'link', label: '🔗 קישור כללי' },
                { id: 'settings', label: '⚙️ הגדרות' },
              ] as Array<{ id: ModalTab; label: string }>
            ).map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    padding: '0.45rem 0.35rem',
                    borderRadius: '9px',
                    border: 'none',
                    background: active ? '#fff' : 'transparent',
                    color: active ? '#4338ca' : '#475569',
                    fontWeight: active ? 800 : 700,
                    fontSize: '0.78rem',
                    boxShadow: active ? '0 2px 6px rgba(15,23,42,0.1)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Clean Scrollable Tab Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.9rem 1rem' }}>
          {saveSuccessMsg && (
            <div
              style={{
                marginBottom: '0.75rem',
                padding: '0.55rem 0.75rem',
                borderRadius: '10px',
                background: '#dcfce7',
                border: '1px solid #86efac',
                color: '#15803d',
                fontWeight: 800,
                fontSize: '0.82rem',
                textAlign: 'center',
              }}
            >
              ✓ {saveSuccessMsg}
            </div>
          )}

          {activeTab === 'people' && (
            <SharePeopleTab
              currentOrigin={currentOrigin}
              recipients={recipients}
              savedDirectory={savedDirectory}
              registeredMembers={registeredMembers}
              supportsContactPicker={supportsContactPicker}
              newRecipientName={newRecipientName}
              setNewRecipientName={setNewRecipientName}
              newRecipientPhone={newRecipientPhone}
              setNewRecipientPhone={setNewRecipientPhone}
              newRecipientRole={newRecipientRole}
              setNewRecipientRole={setNewRecipientRole}
              newRecipientInternalNote={newRecipientInternalNote}
              setNewRecipientInternalNote={setNewRecipientInternalNote}
              newRecipientPublicMessage={newRecipientPublicMessage}
              setNewRecipientPublicMessage={setNewRecipientPublicMessage}
              showNoteFields={showNoteFields}
              setShowNoteFields={setShowNoteFields}
              quickPickPanel={quickPickPanel}
              setQuickPickPanel={setQuickPickPanel}
              copiedRecipientId={copiedRecipientId}
              editingRecipientId={editingRecipientId}
              setEditingRecipientId={setEditingRecipientId}
              editInternalNote={editInternalNote}
              setEditInternalNote={setEditInternalNote}
              editPublicMessage={editPublicMessage}
              setEditPublicMessage={setEditPublicMessage}
              onOpenMemberPicker={() => setIsMemberPickerOpen(true)}
              onPickFromContacts={handlePickFromContacts}
              onAddSavedContact={handleAddSavedContact}
              onAddSavedGroup={handleAddSavedGroup}
              onAddRecipient={handleAddRecipient}
              onWhatsAppRecipient={handleWhatsAppRecipient}
              onCopyRecipientLink={handleCopyRecipientLink}
              onToggleRecipientBlock={handleToggleRecipientBlock}
              onRemoveRecipient={handleRemoveRecipient}
              onStartEditRecipient={handleStartEditRecipient}
              onSaveRecipientNotes={handleSaveRecipientNotes}
            />
          )}

          {activeTab === 'link' && (
            <ShareQuickLinkTab
              isEnabled={isEnabled}
              shareUrl={shareUrl}
              copied={copied}
              scopeSummaryText={scopeSummaryText}
              onEnableSharing={() => setIsEnabled(true)}
              onCopy={handleCopy}
              onWhatsAppShare={handleWhatsAppShare}
              onEmailShare={handleEmailShare}
              onNativeShare={handleNativeShare}
              onOpenSettingsTab={() => setActiveTab('settings')}
            />
          )}

          {activeTab === 'settings' && (
            <ShareSecuritySettingsTab
              isFolder={item.type === 'folder'}
              isEnabled={isEnabled}
              setIsEnabled={setIsEnabled}
              includeSubtree={includeSubtree}
              onToggleSubtree={async (next) => {
                setIncludeSubtree(next);
                if (token && isEnabled) await ensurePersisted(token, recipients, next);
              }}
              directFilesCount={directFilesCount}
              subtreeSubfoldersCount={effectiveSubfolders.length}
              subtreeFilesCount={effectiveFolderFiles.length}
              requirePin={requirePin}
              onTogglePin={(next) => {
                setRequirePin(next);
                if (next && !pin) setPin(generateRandomPin());
              }}
              pin={pin}
              setPin={setPin}
              onGenerateRandomPin={() => setPin(generateRandomPin())}
              expiryOption={expiryOption}
              setExpiryOption={setExpiryOption}
              allowDownload={allowDownload}
              setAllowDownload={setAllowDownload}
              allowUploads={allowUploads}
              setAllowUploads={setAllowUploads}
            />
          )}
        </div>

        {/* Sticky Footer */}
        <div
          style={{
            padding: '0.7rem 1rem',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            display: 'flex',
            gap: '0.55rem',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.62rem 0.95rem',
              borderRadius: '11px',
              border: '1.5px solid #cbd5e1',
              background: '#fff',
              color: '#334155',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
            }}
          >
            סגור
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              flex: 1,
              padding: '0.65rem 1rem',
              borderRadius: '11px',
              border: 'none',
              background: isSaving ? '#94a3b8' : 'linear-gradient(135deg, #4f46e5, #2563eb)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: isSaving ? 'wait' : 'pointer',
            }}
          >
            {isSaving ? '⏳ שומר...' : '💾 שמור הגדרות שיתוף'}
          </button>
        </div>
      </div>

      {isMemberPickerOpen && (
        <RegisteredMemberPickerModal
          isOpen={isMemberPickerOpen}
          members={registeredMembers}
          onClose={() => setIsMemberPickerOpen(false)}
          onSelectMember={(m) => {
            setNewRecipientName(m.name);
            if (m.phone) setNewRecipientPhone(m.phone);
            setIsMemberPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

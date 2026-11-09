'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { FileShareItem, ShareLinkConfig, RecipientShareLink, RecipientRole, createOrUpdatePublicShare, revokePublicShare, generateShareToken, sanitizeFirestoreData } from '@/utils/fileShareUtils';

interface CreateShareLinkModalProps {
  isOpen: boolean;
  item: FileShareItem | null;
  spaceTitle: string;
  folderFiles?: FileShareItem[];
  onClose: () => void;
  onSaved: (updatedLinkConfig?: ShareLinkConfig) => void;
}

export function CreateShareLinkModal({
  isOpen,
  item,
  spaceTitle,
  folderFiles,
  onClose,
  onSaved
}: CreateShareLinkModalProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [requirePin, setRequirePin] = useState(false);
  const [pin, setPin] = useState('');
  const [expiryOption, setExpiryOption] = useState<'never' | '1day' | '7days' | '30days'>('never');
  const [allowDownload, setAllowDownload] = useState(true);
  const [allowUploads, setAllowUploads] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState<string>('');

  // Individual Named Recipients for 1-to-1 Tracking & Blocking
  const [recipients, setRecipients] = useState<RecipientShareLink[]>([]);
  const [newRecipientName, setNewRecipientName] = useState('');
  const [newRecipientRole, setNewRecipientRole] = useState<RecipientRole>('client');
  const [newRecipientPhone, setNewRecipientPhone] = useState('');
  const [copiedRecipientId, setCopiedRecipientId] = useState<string | null>(null);
  const [supportsContactPicker, setSupportsContactPicker] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
      setSupportsContactPicker(true);
    }
  }, []);

  // Helper to generate a secure random 4-digit PIN
  const generateRandomPin = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return String(randomNum);
  };

  useEffect(() => {
    if (isOpen && item) {
      let isMounted = true;
      const link = item.shareLink;
      if (link && (link.token || (Array.isArray(link.recipients) && link.recipients.length > 0))) {
        setIsEnabled(link.enabled !== false);
        const activeToken = link.token || generateShareToken();
        setToken(activeToken);
        setRequirePin(Boolean(link.requirePin));
        setPin(link.pin || '');
        setAllowDownload(link.allowDownload !== false);
        setAllowUploads(link.allowUploads !== false);
        setRecipients(Array.isArray(link.recipients) ? link.recipients : []);

        if (!link.expiresAt) {
          setExpiryOption('never');
        } else {
          const diffDays = Math.round((link.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 1) setExpiryOption('1day');
          else if (diffDays <= 7) setExpiryOption('7days');
          else setExpiryOption('30days');
        }

        // Deep re-hydration directly from canonical shared_links collection if available
        if (link.token) {
          getDoc(doc(db, 'shared_links', link.token))
            .then(snap => {
              if (snap.exists() && isMounted) {
                const data = snap.data();
                if (Array.isArray(data.recipients) && data.recipients.length > 0) {
                  setRecipients(data.recipients);
                  if (item.shareLink) {
                    item.shareLink.recipients = data.recipients;
                  }
                }
              }
            })
            .catch(() => {});
        }
      } else {
        // First time opening or no existing configuration
        setIsEnabled(true);
        setToken(generateShareToken());
        setRequirePin(false);
        setPin('');
        setExpiryOption('never');
        setAllowDownload(true);
        setAllowUploads(true);
        setRecipients([]);
      }
      setCopied(false);
      setNewRecipientName('');
      setNewRecipientPhone('');
      setNewRecipientRole('client');
      setSaveSuccessMsg(null);

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, item?.id]);

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

  const ensurePersisted = async (tokenToUse: string, updatedRecipients?: RecipientShareLink[]): Promise<boolean> => {
    if (!item) return false;
    try {
      const expiresAt = calculateExpiryTimestamp(expiryOption);
      const activeRecipients = updatedRecipients !== undefined ? updatedRecipients : recipients;
      const newConfig: ShareLinkConfig = {
        enabled: true,
        token: tokenToUse,
        requirePin,
        pin: requirePin && pin ? pin.trim() : '',
        expiresAt,
        allowDownload,
        allowUploads,
        viewCount: item.shareLink?.viewCount || 0,
        totalDurationSeconds: item.shareLink?.totalDurationSeconds || 0,
        lastViewedAt: item.shareLink?.lastViewedAt || null,
        createdAt: item.shareLink?.createdAt || Date.now(),
        recipients: activeRecipients
      };

      await createOrUpdatePublicShare(
        item.spaceId,
        spaceTitle,
        item,
        newConfig,
        folderFiles
      );

      // Direct Firestore sync to Space document to ensure zero data loss on immediate modal reopen
      if (item.spaceId) {
        try {
          const spaceDocRef = doc(db, 'spaces', item.spaceId);
          const spaceSnap = await getDoc(spaceDocRef);
          if (spaceSnap.exists()) {
            const currentItems = Array.isArray(spaceSnap.data().fileShareItems) ? [...spaceSnap.data().fileShareItems] : [];
            const idx = currentItems.findIndex((i: any) => i.id === item.id);
            if (idx >= 0) {
              currentItems[idx] = {
                ...currentItems[idx],
                shareLink: newConfig
              };
              await updateDoc(spaceDocRef, sanitizeFirestoreData({ fileShareItems: currentItems }));
            }
          }
        } catch (dbErr) {
          console.warn('Direct space update failed, falling back to onSaved:', dbErr);
        }
      }

      // Update parent object reference in place
      if (item) {
        item.shareLink = newConfig;
      }

      onSaved(newConfig);
      return true;
    } catch (err) {
      console.error('Failed to auto-persist share link:', err);
      return false;
    }
  };

  const handleAddRecipient = async () => {
    if (!newRecipientName.trim()) return;
    const recipientToken = generateShareToken();
    const phoneVal = newRecipientPhone.trim();
    const newRecipient: RecipientShareLink = {
      id: `rcp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recipientName: newRecipientName.trim(),
      role: newRecipientRole,
      phone: phoneVal || '',
      token: recipientToken,
      enabled: true,
      createdAt: Date.now(),
      viewCount: 0,
      totalDurationSeconds: 0,
      lastViewedAt: null
    };

    const nextRecipients = [...recipients, newRecipient];
    setRecipients(nextRecipients);
    setNewRecipientName('');
    setNewRecipientPhone('');
    if (token) {
      await ensurePersisted(token, nextRecipients);
    }
  };

  const handleToggleRecipientBlock = async (recId: string) => {
    const nextRecipients = recipients.map(r => {
      if (r.id === recId) {
        return { ...r, enabled: !r.enabled };
      }
      return r;
    });
    setRecipients(nextRecipients);
    if (token) {
      await ensurePersisted(token, nextRecipients);
    }
  };

  const handleRemoveRecipient = async (recId: string) => {
    const target = recipients.find(r => r.id === recId);
    if (target?.token) {
      await revokePublicShare(target.token);
    }
    const nextRecipients = recipients.filter(r => r.id !== recId);
    setRecipients(nextRecipients);
    if (token) {
      await ensurePersisted(token, nextRecipients);
    }
  };

  const handlePickFromContacts = async () => {
    try {
      if ('contacts' in navigator && 'ContactsManager' in window) {
        const props = ['name', 'tel'];
        const contacts = await (navigator as any).contacts.select(props, { multiple: false });
        if (contacts && contacts.length > 0) {
          const c = contacts[0];
          if (c.name && c.name.length > 0 && c.name[0]) {
            setNewRecipientName(c.name[0]);
          }
          if (c.tel && c.tel.length > 0 && c.tel[0]) {
            // Clean phone string
            const cleanedPhone = c.tel[0].replace(/[^\d+]/g, '');
            setNewRecipientPhone(cleanedPhone);
          }
        }
      } else {
        alert('התכונה "בחירה מאנשי קשר" נתמכת ישירות במכשיר הנייד (Chrome / Android PWA).');
      }
    } catch (err: any) {
      console.warn('Contact picker dismissed or error:', err);
    }
  };

  const handleCopyRecipientLink = async (r: RecipientShareLink) => {
    const url = `${currentOrigin}/share/${r.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedRecipientId(r.id);
      setTimeout(() => setCopiedRecipientId(null), 2500);
    } catch (_) {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedRecipientId(r.id);
      setTimeout(() => setCopiedRecipientId(null), 2500);
    }
  };

  const handleWhatsAppRecipient = (r: RecipientShareLink) => {
    const url = `${currentOrigin}/share/${r.token}`;
    const itemTypeHeb = item?.type === 'folder' ? 'תיקיית' : 'מסמך';
    const pinText = requirePin && pin ? `\n🔐 קוד גישה: ${pin}` : '';
    const text = encodeURIComponent(`שלום ${r.recipientName}, מצורף קישור אישי לצפייה ב${itemTypeHeb} "${item?.name}" מתוך ${spaceTitle}:${pinText}\n${url}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!isEnabled) {
        if (token) {
          await revokePublicShare(token);
        }
        // Also revoke all recipient tokens
        for (const r of recipients) {
          if (r.token) await revokePublicShare(r.token);
        }
        onSaved(undefined);
        onClose();
        return;
      }

      if (requirePin && (!pin || pin.trim().length < 4)) {
        alert('אנא הזן קוד PIN בעל 4 ספרות לפחות להגנה על הקישור.');
        setIsSaving(false);
        return;
      }

      const activeToken = token || generateShareToken();
      const ok = await ensurePersisted(activeToken, recipients);
      if (ok) {
        setSaveSuccessMsg('ההגדרות והנמענים נשמרו בהצלחה!');
        // Dispatch global notification event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('smartshare:fileshare_saved', {
            detail: { message: 'הגדרות השיתוף נשמרו בהצלחה!' }
          }));
        }
        setTimeout(() => {
          setIsSaving(false);
          onClose();
        }, 800);
        return;
      } else {
        alert('שגיאה בשמירת קישור השיתוף לשרת. אנא נסה שוב.');
      }
    } catch (err) {
      console.error('Error saving share link:', err);
      alert('שגיאה ביצירת קישור השיתוף. אנא נסה שוב.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    if (token) await ensurePersisted(token);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Clipboard write failed, trying fallback:', err);
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleWhatsAppShare = async () => {
    if (!shareUrl) return;
    if (token) await ensurePersisted(token);
    const itemTypeHeb = item.type === 'folder' ? 'תיקיית' : 'מסמך';
    const pinText = requirePin && pin ? `\n🔐 קוד גישה: ${pin}` : '';
    const text = encodeURIComponent(`שלום, מצורף קישור לצפייה ב${itemTypeHeb} "${item.name}" מתוך ${spaceTitle}:${pinText}\n${shareUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleEmailShare = async () => {
    if (!shareUrl) return;
    if (token) await ensurePersisted(token);
    const itemTypeHeb = item.type === 'folder' ? 'תיקייה' : 'מסמך';
    const pinText = requirePin && pin ? `\nקוד גישה סודי: ${pin}` : '';
    const subject = encodeURIComponent(`שיתוף ${itemTypeHeb}: ${item.name} מתוך ${spaceTitle}`);
    const body = encodeURIComponent(`שלום,\n\nמצורף קישור לצפייה ב${itemTypeHeb} "${item.name}" מתוך ${spaceTitle}:${pinText}\n\nלצפייה ישירה לחץ על הקישור הבא:\n${shareUrl}\n\nבברכה`);
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
          url: shareUrl
        });
      } catch (err) {
        // User dismissed
      }
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.75rem',
        direction: 'rtl',
        overflowX: 'hidden',
        boxSizing: 'border-box'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'var(--bg-card, #ffffff)',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '92vh',
          borderRadius: '24px',
          padding: '1.15rem 1.25rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          overflowX: 'hidden',
          overflowY: 'hidden',
          boxSizing: 'border-box'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🔗</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                קישור שיתוף חיצוני מאובטח
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {item.type === 'folder' ? '📁 תיקייה:' : '📄 קובץ:'} {item.name}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            style={{ 
              background: 'var(--bg-hover, #f1f5f9)', 
              border: 'none', 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              cursor: 'pointer', 
              fontSize: '1rem', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}
          >
            ✕
          </button>
        </div>

        {/* Master Toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1rem',
          background: isEnabled ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-main, #f8fafc)',
          borderRadius: '16px',
          border: isEnabled ? '1.5px solid var(--primary, #6366f1)' : '1px solid var(--border-light, #e2e8f0)'
        }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
              אפשר גישה חיצונית דרך קישור
            </span>
            <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              כל מי שמחזיק בקישור יוכל לצפות ישירות ללא התקנה
            </span>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px' }}>
            <input 
              type="checkbox" 
              checked={isEnabled} 
              onChange={e => setIsEnabled(e.target.checked)} 
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: 'absolute',
              cursor: 'pointer',
              inset: 0,
              background: isEnabled ? 'var(--primary, #6366f1)' : '#cbd5e1',
              borderRadius: '26px',
              transition: 'all 0.25s ease'
            }}>
              <span style={{
                position: 'absolute',
                content: '""',
                height: '20px',
                width: '20px',
                left: isEnabled ? '25px' : '3px',
                bottom: '3px',
                backgroundColor: 'white',
                borderRadius: '50%',
                transition: 'all 0.25s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }} />
            </span>
          </label>
        </div>

        {/* Security Controls (Shown if enabled) */}
        {isEnabled && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            background: '#ffffff',
            border: '1px solid var(--border-light, #e2e8f0)',
            padding: '0.85rem',
            borderRadius: '16px',
            overflowY: 'auto',
            overflowX: 'hidden',
            maxHeight: 'calc(92vh - 210px)',
            boxSizing: 'border-box'
          }}>
            
            {/* PIN Protection */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <input 
                  type="checkbox" 
                  checked={requirePin} 
                  onChange={e => {
                    const willRequire = e.target.checked;
                    setRequirePin(willRequire);
                    if (willRequire && !pin) {
                      setPin(generateRandomPin());
                    }
                  }}
                  style={{ width: '17px', height: '17px', accentColor: 'var(--primary)' }}
                />
                <span>🔐 הגנה באמצעות קוד גישה (PIN)</span>
              </label>
              {requirePin && (
                <div style={{ marginTop: '0.5rem', width: '100%', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                    <input 
                      type="text" 
                      maxLength={6}
                      placeholder="הזן 4-6 ספרות"
                      value={pin}
                      onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                      style={{
                        flex: 1,
                        width: '0',
                        minWidth: '0',
                        padding: '0.5rem 0.5rem',
                        borderRadius: '10px',
                        border: '1.5px solid var(--primary)',
                        fontSize: '0.95rem',
                        fontWeight: 800,
                        letterSpacing: '3px',
                        textAlign: 'center',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setPin(generateRandomPin())}
                      style={{
                        padding: '0.5rem 0.65rem',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        color: '#1e293b',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                      title="הגרל קוד PIN חדש אקראי"
                    >
                      <span>🎲</span>
                      <span>הגרל קוד</span>
                    </button>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                    קוד PIN נוצר אוטומטית. האורח יידרש להקלידו כדי לצפות במסמך.
                  </span>
                </div>
              )}
            </div>

            {/* Expiration Option */}
            <div>
              <span style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                ⏳ תוקף הקישור:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                {[
                  { id: 'never', label: 'ללא הגבלה' },
                  { id: '1day', label: 'יום 1' },
                  { id: '7days', label: '7 ימים' },
                  { id: '30days', label: '30 יום' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setExpiryOption(opt.id as any)}
                    style={{
                      padding: '0.4rem 0.2rem',
                      borderRadius: '10px',
                      border: expiryOption === opt.id ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                      background: expiryOption === opt.id ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-main)',
                      color: expiryOption === opt.id ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: expiryOption === opt.id ? 800 : 600,
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Allow Download Toggle */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <input 
                  type="checkbox" 
                  checked={allowDownload} 
                  onChange={e => setAllowDownload(e.target.checked)}
                  style={{ width: '17px', height: '17px', accentColor: 'var(--primary)' }}
                />
                <span>📥 אפשר הורדת קבצים למכשיר (או צפייה בלבד)</span>
              </label>
              {!allowDownload && (
                <span style={{ fontSize: '0.72rem', color: '#b45309', display: 'block', marginTop: '3px', paddingRight: '1.6rem' }}>
                  🛡️ מצב צפייה בלבד מופעל - כפתור ההורדה יוסתר מהאורח.
                </span>
              )}
            </div>

            {/* Two-Way Portal Uploads Toggle */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <input 
                  type="checkbox" 
                  checked={allowUploads} 
                  onChange={e => setAllowUploads(e.target.checked)}
                  style={{ width: '17px', height: '17px', accentColor: 'var(--primary)' }}
                />
                <span>📤 אפשר לנמענים להעלות הצעות מחיר, מסמכים ותמונות</span>
              </label>
              <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '3px', paddingRight: '1.6rem' }}>
                📁 כל נמען שיעלה מסמך יקבל תיקייה אישית אוטומטית במרחב שלך עם שמו.
              </span>
            </div>

            {/* Quick Link Share & Copy */}
            {shareUrl && (
              <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
                <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  הקישור האישי שלך:
                </span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input 
                    type="text" 
                    readOnly 
                    value={shareUrl} 
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.65rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-main)',
                      fontSize: '0.78rem',
                      color: 'var(--text-primary)',
                      direction: 'ltr'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    style={{
                      padding: '0.5rem 0.85rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: copied ? '#059669' : 'var(--primary)',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {copied ? '✓ הועתק!' : 'העתק'}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.45rem', marginTop: '0.65rem' }}>
                  <button
                    type="button"
                    onClick={handleWhatsAppShare}
                    style={{
                      padding: '0.6rem 0.4rem',
                      borderRadius: '12px',
                      border: 'none',
                      background: '#25D366',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      boxShadow: '0 2px 6px rgba(37, 211, 102, 0.25)'
                    }}
                  >
                    <span>💬</span> וואטסאפ
                  </button>

                  <button
                    type="button"
                    onClick={handleEmailShare}
                    style={{
                      padding: '0.6rem 0.4rem',
                      borderRadius: '12px',
                      border: 'none',
                      background: '#0284c7',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
                    }}
                  >
                    <span>✉️</span> אימייל
                  </button>

                  {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                    <button
                      type="button"
                      onClick={handleNativeShare}
                      style={{
                        padding: '0.6rem 0.4rem',
                        borderRadius: '12px',
                        border: '1px solid var(--border-light)',
                        background: 'var(--bg-main)',
                        color: 'var(--text-primary)',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <span>🧭</span> שיתוף נוסף
                    </button>
                  )}
                </div>

                {/* Audit stats */}
                {item.shareLink?.viewCount !== undefined && (
                  <div style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span>👁️ נצפה {item.shareLink.viewCount} פעמים</span>
                    {item.shareLink.totalDurationSeconds ? (
                      <span>• ⏱️ שהייה מצטברת: {Math.round(item.shareLink.totalDurationSeconds / 60) > 0 ? `${Math.round(item.shareLink.totalDurationSeconds / 60)} דקות` : `${item.shareLink.totalDurationSeconds} שניות`}</span>
                    ) : null}
                    {item.shareLink.lastViewedAt && (
                      <span>• לאחרונה ב-{new Date(item.shareLink.lastViewedAt).toLocaleDateString('he-IL')}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* NAMED RECIPIENTS SECTION (1-to-1 Tracking & Selective Blocking) */}
            <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  👥 נמענים ומעקב אישי (ללא חיכוך)
                </span>
                <span style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 700 }}>
                  מעקב צפיות + חסימה פרטנית
                </span>
              </div>
              <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.73rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                הוסף שמות של קבלנים או שותפים כדי לקבל עבור כל אחד מהם קישור ייחודי. תוכל לדעת בדיוק מי פתח וכמה זמן צפה, ולחסום אדם ספציפי בכל רגע מבלי לפגוע באחרים.
              </p>

              {/* Add recipient input & role selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '0.75rem', width: '100%', boxSizing: 'border-box' }}>
                {/* Compact Role Switcher (Grid 3 columns, no overflow) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', width: '100%', boxSizing: 'border-box' }}>
                  {(
                    [
                      { id: 'client', label: '👤 לקוח', title: 'מקבל שירות / מזמין' },
                      { id: 'provider', label: '🛠️ ספק', title: 'נותן שירות / קבלן' },
                      { id: 'general', label: '🤝 שותף', title: 'שיתוף מסמכים / כללי' }
                    ] as const
                  ).map(pill => (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => setNewRecipientRole(pill.id)}
                      style={{
                        padding: '6px 2px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: newRecipientRole === pill.id ? 800 : 600,
                        border: newRecipientRole === pill.id ? '1.5px solid #4f46e5' : '1px solid var(--border-light, #e2e8f0)',
                        background: newRecipientRole === pill.id ? '#eff6ff' : 'var(--bg-main, #f8fafc)',
                        color: newRecipientRole === pill.id ? '#4f46e5' : '#64748b',
                        cursor: 'pointer',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={pill.title}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                {/* Input Row: Name + Contact Picker + Add Button */}
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'stretch', width: '100%', boxSizing: 'border-box' }}>
                  <input
                    type="text"
                    placeholder="שם הנמען (למשל: יוסי)"
                    value={newRecipientName}
                    onChange={e => setNewRecipientName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddRecipient();
                      }
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: '0.55rem 0.75rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border-light, #e2e8f0)',
                      background: 'var(--bg-main, #f8fafc)',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)',
                      boxSizing: 'border-box'
                    }}
                  />

                  {/* Native Device Contact Picker Button */}
                  <button
                    type="button"
                    onClick={handlePickFromContacts}
                    style={{
                      flexShrink: 0,
                      padding: '0.55rem 0.65rem',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#334155',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem'
                    }}
                    title="בחר איש קשר ישירות מהטלפון"
                  >
                    <span>📖</span>
                    <span>אנשי קשר</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddRecipient}
                    disabled={!newRecipientName.trim()}
                    style={{
                      flexShrink: 0,
                      padding: '0.55rem 0.85rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: newRecipientName.trim() ? '#4f46e5' : '#cbd5e1',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      cursor: newRecipientName.trim() ? 'pointer' : 'default',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <span>➕</span>
                    <span>הוסף</span>
                  </button>
                </div>

                {/* Phone row: concise placeholder that never cuts off */}
                <div style={{ width: '100%', boxSizing: 'border-box' }}>
                  <input
                    type="tel"
                    placeholder="📱 טלפון נייד (אופציונלי)"
                    value={newRecipientPhone}
                    onChange={e => setNewRecipientPhone(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border-light, #e2e8f0)',
                      background: 'var(--bg-main, #f8fafc)',
                      fontSize: '0.82rem',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
              </div>

              {/* Recipients list */}
              {recipients.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {recipients.map(r => {
                    const isCopied = copiedRecipientId === r.id;
                    const durationText = r.totalDurationSeconds
                      ? (Math.round(r.totalDurationSeconds / 60) > 0 ? `${Math.round(r.totalDurationSeconds / 60)} דק'` : `${r.totalDurationSeconds} שנ'`)
                      : '0 שנ\'';

                    return (
                      <div
                        key={r.id}
                        style={{
                          background: r.enabled ? '#ffffff' : '#fef2f2',
                          border: r.enabled ? '1px solid #e2e8f0' : '1px solid #fecaca',
                          borderRadius: '12px',
                          padding: '0.5rem 0.65rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          fontSize: '0.78rem'
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontWeight: 800, color: r.enabled ? '#0f172a' : '#991b1b', textDecoration: r.enabled ? 'none' : 'line-through' }}>
                              {r.recipientName}
                            </span>
                            <span style={{
                              fontSize: '0.62rem',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              background: r.role === 'provider' ? '#fef3c7' : (r.role === 'client' ? '#e0f2fe' : '#f1f5f9'),
                              color: r.role === 'provider' ? '#b45309' : (r.role === 'client' ? '#0369a1' : '#475569')
                            }}>
                              {r.role === 'provider' ? '🛠️ ספק' : (r.role === 'client' ? '👤 לקוח' : '🤝 כללי')}
                            </span>
                            {r.phone && (
                              <span style={{ fontSize: '0.62rem', color: '#64748b' }}>
                                📞 {r.phone}
                              </span>
                            )}
                            {!r.enabled && (
                              <span style={{ fontSize: '0.62rem', background: '#fee2e2', color: '#b91c1c', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>
                                חסום 🛑
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#64748b', display: 'flex', gap: '0.4rem', marginTop: '2px', flexWrap: 'wrap' }}>
                            <span>👁️ {r.viewCount || 0} צפיות</span>
                            <span>• ⏱️ שהה: {durationText}</span>
                            {r.lastViewedAt && (
                              <span>• נצפה לאחרונה ב-{new Date(r.lastViewedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                            )}
                          </div>
                        </div>

                        {/* Actions for this recipient */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                          {r.enabled && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleWhatsAppRecipient(r)}
                                style={{
                                  background: '#25D366',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '3px 6px',
                                  fontSize: '0.72rem',
                                  cursor: 'pointer',
                                  fontWeight: 700
                                }}
                                title="שלח בוואטסאפ לנמען זה"
                              >
                                💬
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyRecipientLink(r)}
                                style={{
                                  background: isCopied ? '#059669' : '#eff6ff',
                                  color: isCopied ? 'white' : '#2563eb',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: '6px',
                                  padding: '3px 6px',
                                  fontSize: '0.72rem',
                                  cursor: 'pointer',
                                  fontWeight: 700
                                }}
                                title="העתק קישור אישי"
                              >
                                {isCopied ? '✓' : '📋'}
                              </button>
                            </>
                          )}

                          {/* Block / Unblock Toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleRecipientBlock(r.id)}
                            style={{
                              background: r.enabled ? '#fff1f2' : '#f0fdf4',
                              color: r.enabled ? '#e11d48' : '#16a34a',
                              border: r.enabled ? '1px solid #fecdd3' : '1px solid #bbf7d0',
                              borderRadius: '6px',
                              padding: '3px 7px',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                            title={r.enabled ? 'חסום גישה לנמען זה מיידית' : 'בטל חסימה והחזר גישה לנמען זה'}
                          >
                            {r.enabled ? 'חסום' : 'בטל חסימה'}
                          </button>

                          {/* Delete Recipient (Trash Button) */}
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`האם אתה בטוח שברצונך למחוק את הנמען "${r.recipientName}" מהרשימה?`)) {
                                handleRemoveRecipient(r.id);
                              }
                            }}
                            style={{
                              background: '#fef2f2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              borderRadius: '6px',
                              padding: '3px 6px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="מחק נמען זה מהרשימה לחלוטין"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Success Feedback Confirmation */}
        {saveSuccessMsg && (
          <div style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#ffffff',
            padding: '0.65rem 1rem',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 800,
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <span>✓</span>
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            style={{
              flex: 1,
              padding: '0.75rem',
              borderRadius: '14px',
              border: '1px solid var(--border-light)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: isSaving ? 'not-allowed' : 'pointer'
            }}
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              flex: 1.5,
              padding: '0.75rem',
              borderRadius: '14px',
              border: 'none',
              background: saveSuccessMsg ? '#10b981' : 'var(--primary)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: isSaving ? 'wait' : 'pointer',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'background 0.3s'
            }}
          >
            {isSaving ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                <span>שומר לשרת...</span>
              </>
            ) : saveSuccessMsg ? (
              <>
                <span>✓</span>
                <span>נשמר בהצלחה!</span>
              </>
            ) : (
              'שמור והחל הגדרות'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

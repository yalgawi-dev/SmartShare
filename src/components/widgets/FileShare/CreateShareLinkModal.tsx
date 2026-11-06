'use client';

import React, { useState, useEffect } from 'react';
import { FileShareItem, ShareLinkConfig, createOrUpdatePublicShare, revokePublicShare } from '@/utils/fileShareUtils';

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
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    if (isOpen && item) {
      const link = item.shareLink;
      if (link && link.enabled && link.token) {
        setIsEnabled(true);
        setToken(link.token);
        setRequirePin(Boolean(link.requirePin));
        setPin(link.pin || '');
        setAllowDownload(link.allowDownload !== false);

        if (!link.expiresAt) {
          setExpiryOption('never');
        } else {
          const diffDays = Math.round((link.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 1) setExpiryOption('1day');
          else if (diffDays <= 7) setExpiryOption('7days');
          else setExpiryOption('30days');
        }
      } else {
        setIsEnabled(false);
        setToken('');
        setRequirePin(false);
        setPin('');
        setExpiryOption('never');
        setAllowDownload(true);
      }
      setCopied(false);
    }
  }, [isOpen, item]);

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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!isEnabled) {
        if (token) {
          await revokePublicShare(token);
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

      const expiresAt = calculateExpiryTimestamp(expiryOption);
      const newConfig: ShareLinkConfig = {
        enabled: true,
        token: token || undefined,
        requirePin,
        pin: requirePin ? pin.trim() : undefined,
        expiresAt,
        allowDownload,
        viewCount: item.shareLink?.viewCount || 0,
        lastViewedAt: item.shareLink?.lastViewedAt || null,
        createdAt: item.shareLink?.createdAt || Date.now()
      };

      const finalToken = await createOrUpdatePublicShare(
        item.spaceId,
        spaceTitle,
        item,
        newConfig,
        folderFiles
      );

      newConfig.token = finalToken;
      setToken(finalToken);
      onSaved(newConfig);
      onClose();
    } catch (err) {
      console.error('Error saving share link:', err);
      alert('שגיאה ביצירת קישור השיתוף. אנא נסה שוב.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
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

  const handleWhatsAppShare = () => {
    if (!shareUrl) return;
    const itemTypeHeb = item.type === 'folder' ? 'תיקיית' : 'מסמך';
    const pinText = requirePin && pin ? `\n🔐 קוד גישה: ${pin}` : '';
    const text = encodeURIComponent(`שלום, מצורף קישור לצפייה ב${itemTypeHeb} "${item.name}" מתוך ${spaceTitle}:${pinText}\n${shareUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
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
        padding: '1rem',
        direction: 'rtl'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'var(--bg-card, #ffffff)',
          width: '100%',
          maxWidth: '480px',
          borderRadius: '24px',
          padding: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#ffffff', border: '1px solid var(--border-light, #e2e8f0)', padding: '1rem', borderRadius: '16px' }}>
            
            {/* PIN Protection */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <input 
                  type="checkbox" 
                  checked={requirePin} 
                  onChange={e => setRequirePin(e.target.checked)}
                  style={{ width: '17px', height: '17px', accentColor: 'var(--primary)' }}
                />
                <span>🔐 הגנה באמצעות קוד גישה (PIN)</span>
              </label>
              {requirePin && (
                <div style={{ marginTop: '0.5rem', paddingRight: '1.6rem' }}>
                  <input 
                    type="text" 
                    maxLength={6}
                    placeholder="הזן 4-6 ספרות (למשל: 1234)"
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '10px',
                      border: '1.5px solid var(--primary)',
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      letterSpacing: '3px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '3px' }}>
                    האורח יידרש להקליד את הקוד כדי לצפות במסמך.
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

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={handleWhatsAppShare}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      borderRadius: '12px',
                      border: 'none',
                      background: '#25D366',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)'
                    }}
                  >
                    <span>💬</span> שתף בוואטסאפ
                  </button>
                </div>

                {/* Audit stats */}
                {item.shareLink?.viewCount !== undefined && (
                  <div style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>👁️ נצפה {item.shareLink.viewCount} פעמים</span>
                    {item.shareLink.lastViewedAt && (
                      <span>• לאחרונה ב-{new Date(item.shareLink.lastViewedAt).toLocaleDateString('he-IL')}</span>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '0.75rem',
              borderRadius: '14px',
              border: '1px solid var(--border-light)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer'
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
              background: 'var(--primary)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: isSaving ? 'wait' : 'pointer',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
            }}
          >
            {isSaving ? 'שומר...' : 'שמור והחל הגדרות'}
          </button>
        </div>
      </div>
    </div>
  );
}

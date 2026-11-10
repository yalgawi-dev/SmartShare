'use client';

import React, { use, useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getPublicShare, recordPublicShareView, recordShareHeartbeat, isShareExpired, PublicSharedData, formatFileSize, uploadRecipientSubmission } from '@/utils/fileShareUtils';
import { saveSharedLink } from '@/utils/savedSharedLinksUtils';
import { uploadBlobToStorage } from '@/lib/firebase';
import UniversalViewerModal from '@/components/common/ViewerEngine/UniversalViewerModal';
import { SenderBusinessCardBanner } from '@/components/share/SenderBusinessCardBanner';
import PdfThumbnail from '@/components/shared/PdfThumbnail';
import ChatEngineUI from '@/components/widgets/Chat/ChatEngineUI';
import { onSnapshot } from 'firebase/firestore';

interface SharePageProps {
  params: Promise<{ token: string }>;
}

export default function PublicSharePage({ params }: SharePageProps) {
  const { token } = use(params);

  const [loading, setLoading] = useState(true);
  const [shareData, setShareData] = useState<PublicSharedData | null>(null);
  const [errorState, setErrorState] = useState<'not_found' | 'expired' | null>(null);

  // PIN challenge state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Viewer state
  const [previewState, setPreviewState] = useState<{ docs: any[]; index: number } | null>(null);

  // Heartbeat tracking for time spent in document (Audit duration)
  const startTimeRef = useRef<number>(Date.now());
  const intervalRef = useRef<any>(null);

  // Recipient Two-Way Submissions state
  const submissionFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [submissionNote, setSubmissionNote] = useState('');
  const [submissionPhone, setSubmissionPhone] = useState('');
  const [uploadedFilesList, setUploadedFilesList] = useState<string[]>([]);

  // Guest Direct Chat state & Live Space Subscription
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [liveSpace, setLiveSpace] = useState<any>(null);

  useEffect(() => {
    if (isUnlocked && token) {
      startTimeRef.current = Date.now();
      // Send heartbeat every 15 seconds
      intervalRef.current = setInterval(() => {
        recordShareHeartbeat(token, 15);
      }, 15000);

      const handleUnload = () => {
        const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
        if (elapsed > 0) {
          recordShareHeartbeat(token, elapsed % 15);
        }
      };
      window.addEventListener('beforeunload', handleUnload);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        window.removeEventListener('beforeunload', handleUnload);
      };
    }
  }, [isUnlocked, token]);

  useEffect(() => {
    async function loadData() {
      if (!token) {
        setErrorState('not_found');
        setLoading(false);
        return;
      }

      const data = await getPublicShare(token);
      if (!data) {
        setErrorState('not_found');
        setLoading(false);
        return;
      }

      if (isShareExpired(data.expiresAt)) {
        setErrorState('expired');
        setLoading(false);
        return;
      }

      let enrichedData = { ...data };
      if ((!enrichedData.businessCard || !enrichedData.spaceLogoUrl) && enrichedData.spaceId) {
        try {
          const spaceSnap = await getDoc(doc(db, 'spaces', enrichedData.spaceId));
          if (spaceSnap.exists()) {
            const sData = spaceSnap.data();
            const hasBusinessFeature = Array.isArray(sData?.features) && sData.features.includes('business_card');
            if (hasBusinessFeature) {
              if (!enrichedData.businessCard && sData?.settings?.businessCard) {
                enrichedData.businessCard = sData.settings.businessCard;
              }
              if (!enrichedData.spaceLogoUrl && sData?.logoUrl) {
                enrichedData.spaceLogoUrl = sData.logoUrl;
              }
            }
          }
        } catch (_) {}
      }

      setShareData(enrichedData);
      if (!enrichedData.requirePin || !enrichedData.pin) {
        setIsUnlocked(true);
        recordPublicShareView(token);
        saveSharedLink({
          token,
          name: enrichedData.name,
          itemType: enrichedData.itemType,
          fileType: enrichedData.fileType,
          spaceTitle: enrichedData.spaceTitle,
          spaceLogoUrl: enrichedData.spaceLogoUrl
        });
        if (enrichedData.itemType !== 'folder') {
          openViewerForFile(enrichedData as any);
        }
      }
      setLoading(false);
    }

    loadData();
  }, [token]);

  // Subscribe to live space updates for two-way chat
  useEffect(() => {
    if (!shareData?.spaceId) return;
    const unsub = onSnapshot(doc(db, 'spaces', shareData.spaceId), snap => {
      if (snap.exists()) {
        setLiveSpace({ id: snap.id, ...snap.data() });
      }
    }, err => {
      console.warn('Live space listener error:', err);
    });
    return () => unsub();
  }, [shareData?.spaceId]);

  const handleUnlockPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareData) return;

    if (pinInput.trim() === shareData.pin?.trim()) {
      setIsUnlocked(true);
      setPinError(false);
      recordPublicShareView(token);
      saveSharedLink({
        token,
        name: shareData.name,
        itemType: shareData.itemType,
        fileType: shareData.fileType,
        spaceTitle: shareData.spaceTitle,
        spaceLogoUrl: shareData.spaceLogoUrl
      });
      if (shareData.itemType !== 'folder') {
        openViewerForFile(shareData as any);
      }
    } else {
      setPinError(true);
    }
  };

  const handleDownload = async (url?: string, filename?: string) => {
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.warn('Download fetch failed, opening in new tab:', err);
      window.open(url, '_blank');
    }
  };

  const openViewerForFile = (fileItem: { id: string; url: string; name: string; thumbnailUrl?: string; pages?: string[]; fileType?: string }, allContainedFiles?: any[]) => {
    const docs = (allContainedFiles && allContainedFiles.length > 0 ? allContainedFiles : [fileItem]).map(f => {
      const isPdf = f.fileType === 'pdf' || f.name?.toLowerCase().endsWith('.pdf') || f.url?.toLowerCase().includes('.pdf');
      const safeThumb = f.thumbnailUrl || (Array.isArray(f.pages) && f.pages.length > 0 ? f.pages[0] : (!isPdf && f.url ? f.url : undefined));
      return {
        id: f.id,
        url: f.url,
        title: f.name,
        type: f.fileType || (isPdf ? 'pdf' : 'other'),
        thumbnailUrl: safeThumb,
        pages: f.pages || (safeThumb ? [safeThumb] : (f.url ? [f.url] : []))
      };
    });
    const idx = docs.findIndex(d => d.id === fileItem.id);
    setPreviewState({ docs, index: idx >= 0 ? idx : 0 });
  };

  const handleRecipientFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !shareData) return;

    setIsSubmitting(true);
    try {
      const now = Date.now();
      const uploadedNames: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isImg = file.type.startsWith('image/');
        const fileType = isPdf ? 'pdf' : (isImg ? 'image' : 'other');

        // Storage upload
        const storagePath = `spaces/${shareData.spaceId}/submissions/${shareData.recipientId || 'guest'}_${now}_${file.name}`;
        const downloadUrl = await uploadBlobToStorage(file, storagePath);

        const res = await uploadRecipientSubmission(
          token,
          {
            name: file.name,
            url: downloadUrl,
            fileType,
            size: file.size
          },
          submissionNote.trim(),
          submissionPhone.trim() || shareData.recipientPhone
        );

        if (res.success) {
          uploadedNames.push(file.name);
        }
      }

      if (uploadedNames.length > 0) {
        setUploadedFilesList(prev => [...prev, ...uploadedNames]);
        setSubmissionSuccess(true);
        setTimeout(() => setSubmissionSuccess(false), 5000);
      }
    } catch (err: any) {
      console.error('Submission error:', err);
      alert('שגיאה בהעלאת המסמכים. אנא נסה שוב.');
    } finally {
      setIsSubmitting(false);
      if (submissionFileInputRef.current) {
        submissionFileInputRef.current.value = '';
      }
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'rtl', background: '#f8fafc', padding: '1.5rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'spin 1s infinite linear' }}>⏳</div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>טוען מסמך מאובטח...</h2>
      </div>
    );
  }

  if (errorState === 'not_found' || !shareData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'rtl', background: '#f8fafc', padding: '1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginBottom: '0.5rem' }}>הקובץ אינו זמין</h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '360px', margin: 0 }}>
          הקישור אינו קיים, או שבוטל על ידי בעל המרחב. אנא פנה לשולח הקישור לקבלת גישה.
        </p>
      </div>
    );
  }

  if (errorState === 'expired') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'rtl', background: '#f8fafc', padding: '1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⌛</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#b91c1c', marginBottom: '0.5rem' }}>הקישור פג תוקף</h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '360px', margin: 0 }}>
          תוקף הקישור למסמך זה פג מטעמי אבטחה. פנה לבעל המרחב כדי להפיק קישור חדש.
        </p>
      </div>
    );
  }

  // PIN Protection Gate
  if (!isUnlocked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', direction: 'rtl', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '1.5rem' }}>
        <div style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: '380px',
          borderRadius: '24px',
          padding: '2rem 1.75rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔐</div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
            מסמך מוגן בקוד גישה
          </h2>
          <p style={{ margin: '0.4rem 0 1.25rem 0', fontSize: '0.82rem', color: '#64748b' }}>
            הזן את קוד ה-PIN שנמסר לך לצפייה ב-{shareData.itemType === 'folder' ? 'תיקייה' : 'קובץ'}:<br />
            <strong>&quot;{shareData.name}&quot;</strong>
          </p>

          <form onSubmit={handleUnlockPin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
              maxLength={6}
              placeholder="הזן קוד PIN"
              value={pinInput}
              onChange={e => {
                setPinInput(e.target.value.replace(/\D/g, ''));
                setPinError(false);
              }}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '12px',
                border: pinError ? '2px solid #ef4444' : '1.5px solid #6366f1',
                fontSize: '1.25rem',
                fontWeight: 900,
                textAlign: 'center',
                letterSpacing: '8px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />

            {pinError && (
              <span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 700 }}>
                קוד PIN שגוי, אנא נסה שנית.
              </span>
            )}

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '0.85rem',
                borderRadius: '14px',
                border: 'none',
                background: '#4f46e5',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)'
              }}
            >
              פתח מסמך
            </button>
          </form>
        </div>
      </div>
    );
  }

  const isFolder = shareData.itemType === 'folder';

  return (
    <>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
        <title>{shareData.name} | MySpace</title>
      </Head>

      <div style={{
        minHeight: '100vh',
        background: '#f8fafc',
        direction: 'rtl',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Top Brand Banner: MySpace App Branding */}
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          padding: '0.45rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#ffffff',
          fontSize: '0.78rem',
          fontWeight: 700,
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img 
              src="/myspace_logo.png" 
              alt="MySpace Logo" 
              style={{ width: '22px', height: '22px', borderRadius: '6px', objectFit: 'contain', background: '#ffffff', padding: '1px' }} 
            />
            <span style={{ letterSpacing: '0.3px', fontWeight: 900 }}>
              שותף באמצעות אפליקציית MySpace
            </span>
          </div>

          <Link
            href="/"
            style={{
              color: '#a5b4fc',
              textDecoration: 'none',
              fontSize: '0.72rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              background: 'rgba(255,255,255,0.12)',
              padding: '2px 8px',
              borderRadius: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <span>פתח מרחב משלך בחינם</span>
            <span>↗</span>
          </Link>
        </div>

        {/* Top Portal Navigation Header */}
        <header style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '0.85rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.5rem' }}>{isFolder ? '📁' : '📄'}</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
                  {shareData.name}
                </h1>
                <span style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '6px', fontWeight: 800 }}>
                  🔒 שיתוף מאובטח
                </span>
                {shareData.recipientName && (
                  <span style={{ fontSize: '0.68rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '1px 7px', borderRadius: '6px', fontWeight: 800 }}>
                    שלום, {shareData.recipientName} 👋
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>
                מתוך מרחב: <strong>{shareData.spaceTitle}</strong> באפליקציית MySpace
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Direct Open Viewer Button */}
            {!isFolder && (
              <button
                type="button"
                onClick={() => openViewerForFile(shareData as any)}
                style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '12px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)'
                }}
              >
                <span>🔍</span> צפייה במסמך
              </button>
            )}

            {/* Download button for single file */}
            {!isFolder && shareData.allowDownload && shareData.url && (
              <button
                type="button"
                onClick={() => handleDownload(shareData.url, shareData.name)}
                style={{
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <span>📥</span> הורד
              </button>
            )}

            {!isFolder && !shareData.allowDownload && (
              <span style={{ fontSize: '0.74rem', background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '8px', fontWeight: 700 }}>
                🛡️ צפייה בלבד
              </span>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main style={{ flex: 1, maxWidth: '900px', width: '100%', margin: '0 auto', padding: '1.25rem' }}>
          
          {/* Sender Hero Digital Business Card & Portfolio */}
          <SenderBusinessCardBanner shareData={shareData} />

          {/* Personal Message from Space Owner if provided */}
          {shareData.publicMessage && (
            <div style={{
              margin: '0.85rem 0',
              padding: '0.9rem 1.1rem',
              borderRadius: '16px',
              background: '#ffffff',
              border: '1.5px solid #bfdbfe',
              boxShadow: '0 2px 8px rgba(30, 64, 175, 0.06)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem'
            }}>
              <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>✉️</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e40af', marginBottom: '2px' }}>
                  הודעה אישית מבעל המרחב:
                </div>
                <div style={{ fontSize: '0.88rem', color: '#0f172a', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {shareData.publicMessage}
                </div>
              </div>
            </div>
          )}

          {isFolder ? (
            /* FOLDER VIEW: GRID OF CONTAINED FILES MATCHING APP DESKTOP/MOBILE VIEW */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📄</span>
                  <span>קבצים בתיקייה ({(shareData.folderFiles || []).length}):</span>
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: '0.85rem'
              }}>
                {(shareData.folderFiles || []).map((f, idx) => {
                  const isPdf = f.fileType === 'pdf' || f.name?.toLowerCase().endsWith('.pdf') || f.url?.toLowerCase().includes('.pdf');
                  const isImg = f.fileType === 'image' || f.url?.match(/\.(jpg|jpeg|png|webp|gif)/i);
                  const previewUrl = f.thumbnailUrl || (Array.isArray(f.pages) && f.pages.length > 0 ? f.pages[0] : (isImg ? f.url : ''));

                  return (
                    <div
                      key={f.id}
                      onClick={() => openViewerForFile(f, shareData.folderFiles)}
                      style={{
                        background: '#ffffff',
                        borderRadius: '14px',
                        overflow: 'hidden',
                        border: '1px solid #e2e8f0',
                        position: 'relative',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                      }}
                    >
                      {/* Preview Image / PDF Canvas Container */}
                      <div
                        style={{
                          height: '140px',
                          background: '#f1f5f9',
                          backgroundImage: previewUrl ? `url(${previewUrl})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Index Badge (#1, #2...) */}
                        <div style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          background: 'rgba(15, 23, 42, 0.82)',
                          backdropFilter: 'blur(4px)',
                          color: '#ffffff',
                          padding: '1px 7px',
                          borderRadius: '6px',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          zIndex: 15,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}>
                          #{idx + 1}
                        </div>

                        {/* Fallback PDF Thumbnail when no image */}
                        {!previewUrl && (
                          isPdf && f.url ? (
                            <PdfThumbnail url={f.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '2.5rem' }}>{isPdf ? '📕' : '📄'}</span>
                          )
                        )}

                        {/* Cloud Badge (☁️ ענן) */}
                        <div style={{
                          position: 'absolute',
                          bottom: '5px',
                          right: '5px',
                          background: 'rgba(37, 99, 235, 0.9)',
                          color: 'white',
                          padding: '1px 6px',
                          borderRadius: '5px',
                          fontSize: '0.62rem',
                          fontWeight: 700
                        }}>
                          ☁️ ענן
                        </div>

                        {/* Multi-page badge */}
                        {f.pages && f.pages.length > 1 && (
                          <div style={{
                            position: 'absolute',
                            bottom: '5px',
                            left: '5px',
                            background: 'rgba(15, 23, 42, 0.85)',
                            color: 'white',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            fontSize: '0.62rem',
                            fontWeight: 800
                          }}>
                            {f.pages.length}p
                          </div>
                        )}
                      </div>

                      {/* Content Details */}
                      <div style={{ padding: '0.45rem 0.55rem', display: 'flex', flexDirection: 'column', flex: 1, gap: '0.2rem' }}>
                        {/* Title */}
                        <div
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 800,
                            color: '#1e293b',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          title={f.name}
                        >
                          {f.name}
                        </div>

                        {/* Metadata: Size & Date */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.66rem', color: '#64748b', marginTop: 'auto' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                            {f.size ? (
                              <span style={{ fontSize: '0.62rem', background: '#f1f5f9', color: '#334155', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, border: '1px solid #e2e8f0' }}>
                                ⚖️ {formatFileSize(f.size)}
                              </span>
                            ) : null}
                          </span>
                        </div>

                        {/* Bottom Actions for guest: Watch & Download */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9' }} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => openViewerForFile(f, shareData.folderFiles)}
                            style={{
                              flex: 1,
                              background: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              padding: '3px 0',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              textAlign: 'center'
                            }}
                          >
                            צפה
                          </button>
                          {shareData.allowDownload && (
                            <button
                              type="button"
                              onClick={() => handleDownload(f.url, f.name)}
                              style={{
                                background: '#f8fafc',
                                color: '#475569',
                                border: '1px solid #cbd5e1',
                                padding: '3px 6px',
                                borderRadius: '6px',
                                fontSize: '0.74rem',
                                cursor: 'pointer'
                              }}
                              title="הורד קובץ"
                            >
                              📥
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {(!shareData.folderFiles || shareData.folderFiles.length === 0) && (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b', background: '#ffffff', borderRadius: '16px', border: '2px dashed #e2e8f0' }}>
                  התיקייה ריקה מקבצים.
                </div>
              )}
            </div>
          ) : (
            /* SINGLE FILE VIEW */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              <div style={{
                background: '#ffffff',
                width: '100%',
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
                padding: '1.5rem',
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.25rem'
              }}>
                {/* Embedded Viewer Trigger */}
                <div 
                  onClick={() => openViewerForFile(shareData as any)}
                  style={{
                    width: '100%',
                    maxHeight: '65vh',
                    minHeight: '300px',
                    borderRadius: '14px',
                    background: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  {shareData.url && (shareData.fileType === 'image' || shareData.url.match(/\.(jpg|jpeg|png|webp|gif)/i)) ? (
                    <img 
                      src={shareData.url} 
                      alt={shareData.name} 
                      style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain' }} 
                    />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#ffffff', padding: '2rem' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📕</div>
                      <span style={{ fontSize: '1rem', fontWeight: 800 }}>לחץ כאן לפתיחת צפיין המסמך המלא</span>
                    </div>
                  )}

                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    background: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(8px)',
                    color: '#ffffff',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}>
                    <span>🔍</span> לחץ לתצוגה מלאה וזום
                  </div>
                </div>

                {/* Prominent Open Viewer CTA Button */}
                <button
                  type="button"
                  onClick={() => openViewerForFile(shareData as any)}
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span>🔍</span> פתח בצפיין המלא (מגילה רציפה וזום עמוק עד 3000%)
                </button>
              </div>
            </div>
          )}

          {/* TWO-WAY RECIPIENT SUBMISSION / CLIENT & CONTRACTOR PORTAL */}
          {shareData.allowUploads !== false && (
            <div style={{
              marginTop: '1.75rem',
              background: '#ffffff',
              borderRadius: '24px',
              border: '1.5px solid #e0e7ff',
              padding: '1.5rem',
              boxShadow: '0 8px 24px rgba(79, 70, 229, 0.07)',
              direction: 'rtl'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.6rem' }}>
                <span style={{
                  fontSize: '1.4rem',
                  background: '#eff6ff',
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#4f46e5'
                }}>
                  {shareData.recipientRole === 'provider' ? '💼' : (shareData.recipientRole === 'client' ? '📋' : '📤')}
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
                    {shareData.recipientRole === 'provider' 
                      ? 'הגשת הצעת מחיר ומסמכי ספק' 
                      : (shareData.recipientRole === 'client' ? 'צירוף מסמכים ובקשות לקוח' : 'ערוץ הגשת קבצים ישיר')}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                    {shareData.recipientRole === 'provider'
                      ? 'העלה הצעת מחיר חתומה, מפרט טכני או תעודות משלוח ישירות לתיק הפרויקט'
                      : 'העלה מסמכים, אישורים, תוכניות או תמונות מהשטח שיסודרו בתיק האישי שלך'}
                  </p>
                </div>
              </div>

              {/* Hidden file input */}
              <input
                ref={submissionFileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={handleRecipientFileUpload}
              />

              {/* Optional Phone & Note fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input
                    type="tel"
                    placeholder="מספר טלפון להתקשרות (אופציונלי)"
                    value={submissionPhone}
                    onChange={e => setSubmissionPhone(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: '180px',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.82rem',
                      background: '#f8fafc'
                    }}
                  />
                  <input
                    type="text"
                    placeholder="הערה / נושא הקובץ (למשל: הצעת מחיר מעודכנת)"
                    value={submissionNote}
                    onChange={e => setSubmissionNote(e.target.value)}
                    style={{
                      flex: 1.5,
                      minWidth: '220px',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.82rem',
                      background: '#f8fafc'
                    }}
                  />
                </div>

                {/* Upload Button */}
                <button
                  type="button"
                  onClick={() => submissionFileInputRef.current?.click()}
                  disabled={isSubmitting}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '14px',
                    border: 'none',
                    background: isSubmitting ? '#94a3b8' : 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    cursor: isSubmitting ? 'wait' : 'pointer',
                    boxShadow: '0 4px 14px rgba(79, 70, 229, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span>{isSubmitting ? '⏳' : '📎'}</span>
                  <span>{isSubmitting ? 'מעלה מסמכים ומסדר בתיק...' : 'בחר קבצים להעלאה (PDF או תמונות)'}</span>
                </button>

                {/* Success Banner */}
                {submissionSuccess && (
                  <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '12px',
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    color: '#065f46',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    animation: 'fadeIn 0.3s'
                  }}>
                    <span>✅</span>
                    <span>הקבצים הועלו בהצלחה ונשמרו בתיק הייעודי במערכת!</span>
                  </div>
                )}

                {/* Uploaded items in this session */}
                {uploadedFilesList.length > 0 && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#475569', background: '#f8fafc', padding: '0.6rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontWeight: 800, display: 'block', marginBottom: '4px' }}>קבצים שהועלו על ידך כעת ({uploadedFilesList.length}):</span>
                    <ul style={{ margin: 0, paddingRight: '1.2rem' }}>
                      {uploadedFilesList.map((fname, fidx) => (
                        <li key={fidx}>{fname}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Viral Conversion / Invite Guest to MySpace */}
          <div style={{
            marginTop: '2rem',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
            borderRadius: '24px',
            padding: '1.75rem 1.5rem',
            color: '#ffffff',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.85rem'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '18px',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}>
              <img 
                src="/myspace_logo.png" 
                alt="MySpace Logo" 
                style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
              />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#ffffff' }}>
                רוצה לשתף קבצים ותוכניות בקלות כזאת?
              </h3>
              <p style={{ margin: '0.45rem 0 0 0', fontSize: '0.84rem', color: '#cbd5e1', maxWidth: '440px', lineHeight: 1.5 }}>
                הצטרף לאפליקציית <strong>MySpace</strong> – שיתוף תוכניות ומסמכים כבדים באיכות מלאה (זום עמוק עד 3000%), סורק מסמכים חכם, ומעקב אישי אחרי צפיות של קבלנים ושותפים.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: '400px', marginTop: '0.4rem' }}>
              <Link
                href="/"
                style={{
                  flex: 1.2,
                  minWidth: '160px',
                  padding: '0.85rem 1.25rem',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  textAlign: 'center',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem'
                }}
              >
                <span>✨</span>
                <span>הצטרף חינם ל-MySpace</span>
              </Link>

              <Link
                href={`/space/${shareData.spaceId}`}
                style={{
                  flex: 1,
                  minWidth: '140px',
                  padding: '0.85rem 1rem',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  textAlign: 'center',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.3rem'
                }}
              >
                <span>🔑</span>
                <span>כניסה למרחב</span>
              </Link>
            </div>
          </div>
        </main>

        {/* Floating 2-Way Chat Button (Direct Guest ↔ Owner Chat) - ONLY if Chat feature is enabled on space */}
        {shareData.spaceId && (liveSpace?.features?.includes('chat') || shareData.features?.includes('chat')) && (
          <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 99990
          }}>
            <button
              type="button"
              onClick={() => setIsChatOpen(prev => !prev)}
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '30px',
                padding: '0.75rem 1.25rem',
                fontSize: '0.9rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'transform 0.15s ease'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>💬</span>
              <span>שאל את בעל המרחב</span>
            </button>
          </div>
        )}

        {/* Guest Chat Drawer / Modal using ChatEngineUI */}
        {isChatOpen && liveSpace && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 99999,
            display: 'flex',
            justifyContent: 'flex-end',
            direction: 'rtl'
          }}>
            <div style={{
              width: '100%',
              maxWidth: '480px',
              height: '100%',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-4px 0 20px rgba(0,0,0,0.2)'
            }}>
              {/* Header */}
              <div style={{
                background: '#1e293b',
                color: '#ffffff',
                padding: '0.85rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.3rem' }}>💬</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>
                      שיחה עם {liveSpace.createdBy || 'מנהל המרחב'}
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      הודעות ישירות ופרטיות (גלויות לך ולמנהלי המרחב בלבד)
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChatOpen(false)}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: 'none',
                    color: '#ffffff',
                    width: '30px',
                    height: '30px',
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

              {/* Chat Engine Body */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <ChatEngineUI
                  space={liveSpace}
                  conversationId={shareData.chatChannelId || `guest_${token}`}
                  viewMode="peer"
                  isGroup={false}
                  isFrozen={false}
                />
              </div>
            </div>
          </div>
        )}

        {/* Universal Viewer Modal */}
        {previewState && (
          <UniversalViewerModal
            docs={previewState.docs}
            initialIndex={previewState.index}
            onClose={() => setPreviewState(null)}
            onDownload={shareData.allowDownload ? (url, title) => handleDownload(url, title) : undefined}
          />
        )}
      </div>
    </>
  );
}

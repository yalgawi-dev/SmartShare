'use client';

import React, { use, useState, useEffect } from 'react';
import Head from 'next/head';
import { getPublicShare, recordPublicShareView, isShareExpired, PublicSharedData, formatFileSize } from '@/utils/fileShareUtils';
import UniversalViewerModal from '@/components/common/ViewerEngine/UniversalViewerModal';

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

      setShareData(data);
      if (!data.requirePin || !data.pin) {
        setIsUnlocked(true);
        recordPublicShareView(token);
      }
      setLoading(false);
    }

    loadData();
  }, [token]);

  const handleUnlockPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareData) return;

    if (pinInput.trim() === shareData.pin?.trim()) {
      setIsUnlocked(true);
      setPinError(false);
      recordPublicShareView(token);
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

  const openViewerForFile = (fileItem: { id: string; url: string; name: string; pages?: string[]; fileType?: string }, allContainedFiles?: any[]) => {
    const docs = (allContainedFiles && allContainedFiles.length > 0 ? allContainedFiles : [fileItem]).map(f => ({
      id: f.id,
      url: f.url,
      title: f.name,
      type: f.fileType || 'other',
      pages: f.pages || (f.url ? [f.url] : [])
    }));
    const idx = docs.findIndex(d => d.id === fileItem.id);
    setPreviewState({ docs, index: idx >= 0 ? idx : 0 });
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
        <title>{shareData.name} | SmartShare</title>
      </Head>

      <div style={{
        minHeight: '100vh',
        background: '#f8fafc',
        direction: 'rtl',
        display: 'flex',
        flexDirection: 'column'
      }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
                  {shareData.name}
                </h1>
                <span style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '6px', fontWeight: 800 }}>
                  🔒 שיתוף מאובטח
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>
                מתוך: {shareData.spaceTitle}
              </p>
            </div>
          </div>

          {/* Download button for single file */}
          {!isFolder && shareData.allowDownload && shareData.url && (
            <button
              type="button"
              onClick={() => handleDownload(shareData.url, shareData.name)}
              style={{
                background: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                padding: '0.5rem 0.9rem',
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
              <span>📥</span> הורד
            </button>
          )}

          {!isFolder && !shareData.allowDownload && (
            <span style={{ fontSize: '0.74rem', background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '8px', fontWeight: 700 }}>
              🛡️ צפייה בלבד
            </span>
          )}
        </header>

        {/* Main Content Area */}
        <main style={{ flex: 1, maxWidth: '900px', width: '100%', margin: '0 auto', padding: '1.25rem' }}>
          {isFolder ? (
            /* FOLDER VIEW: LIST OF CONTAINED FILES */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#475569' }}>
                  קבצים בתיקייה ({(shareData.folderFiles || []).length})
                </span>
              </div>

              {(shareData.folderFiles || []).map(f => (
                <div
                  key={f.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    cursor: 'pointer'
                  }}
                  onClick={() => openViewerForFile(f, shareData.folderFiles)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>
                      {f.fileType === 'pdf' ? '📕' : f.fileType === 'image' ? '🖼️' : '📄'}
                    </span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                        {f.name}
                      </h4>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {f.size ? formatFileSize(f.size) : 'קובץ'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openViewerForFile(f, shareData.folderFiles)}
                      style={{
                        background: '#eff6ff',
                        color: '#2563eb',
                        border: '1px solid #bfdbfe',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '10px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      צפה
                    </button>
                    {shareData.allowDownload && (
                      <button
                        type="button"
                        onClick={() => handleDownload(f.url, f.name)}
                        style={{
                          background: '#f1f5f9',
                          color: '#475569',
                          border: 'none',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '10px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                        title="הורד קובץ"
                      >
                        📥
                      </button>
                    )}
                  </div>
                </div>
              ))}

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
              </div>
            </div>
          )}
        </main>

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

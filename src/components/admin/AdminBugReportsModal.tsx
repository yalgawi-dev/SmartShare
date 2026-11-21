'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BugReportRecord,
  fetchAllBugReportsForAdmin,
  updateBugReportStatus,
  deleteBugReportRecord
} from '@/components/common/AssistantEngine/assistantBugReporter';
import { APP_VERSION } from '@/constants/version';

interface AdminBugReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCountChange?: (newCount: number) => void;
}

export const AdminBugReportsModal: React.FC<AdminBugReportsModalProps> = ({
  isOpen,
  onClose,
  onCountChange
}) => {
  const [reports, setReports] = useState<BugReportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'in_progress' | 'resolved'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedReportId, setCopiedReportId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllBugReportsForAdmin();
      setReports(data);
      const newCount = data.filter((r) => r.status === 'new').length;
      onCountChange?.(newCount);
    } catch (err) {
      console.error('Error loading bug reports:', err);
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    if (isOpen) {
      loadReports();
      setConfirmDeleteId(null);
    }
  }, [isOpen, loadReports]);

  const handleStatusChange = async (reportId: string, nextStatus: 'new' | 'in_progress' | 'resolved') => {
    try {
      await updateBugReportStatus(reportId, nextStatus);
      setReports((prev) => {
        const updated = prev.map((r) => (r.id === reportId ? { ...r, status: nextStatus } : r));
        onCountChange?.(updated.filter((r) => r.status === 'new').length);
        return updated;
      });
    } catch (err) {
      console.error('Failed updating status:', err);
    }
  };

  const handleDelete = async (reportId: string) => {
    try {
      await deleteBugReportRecord(reportId);
      setConfirmDeleteId(null);
      setReports((prev) => {
        const updated = prev.filter((r) => r.id !== reportId);
        onCountChange?.(updated.filter((r) => r.status === 'new').length);
        return updated;
      });
    } catch (err) {
      console.error('Failed deleting bug report:', err);
    }
  };

  const handleCopyForAI = async (rep: BugReportRecord) => {
    const promptForAI = [
      `🐞 דוח תקלה ממשתמש לתיקון ב-MySpace (${rep.telemetry?.appVersion || APP_VERSION}):`,
      `- מדווח: ${rep.reporter?.name || 'אורח'} (${rep.reporter?.phone || 'ללא טלפון'})`,
      `- תיאור התקלה: ${rep.description}`,
      `- מיקום באפליקציה: ${rep.telemetry?.spaceTitle ? `מרחב "${rep.telemetry.spaceTitle}"` : rep.telemetry?.route} | כלי פעיל: ${rep.telemetry?.activeWidget || 'כללי'}`,
      `- מכשיר: ${rep.telemetry?.deviceOS} (${rep.telemetry?.screenSize})`,
      `- כפתורים על המסך ברגע התקלה: ${(rep.telemetry?.domSnapshot?.visibleButtonsAndActions || []).slice(0, 15).join(', ')}`,
      `- שיחה אחרונה עם הסוכן: ${rep.chatContextSummary || 'ללא'}`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(promptForAI);
      if (rep.id) {
        setCopiedReportId(rep.id);
        setTimeout(() => setCopiedReportId(null), 2500);
      }
    } catch (_) {}
  };

  if (!isOpen) return null;

  const filteredReports = reports.filter((r) => (filterStatus === 'all' ? true : r.status === filterStatus));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px',
        direction: 'rtl'
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: '860px',
          height: '88dvh',
          maxHeight: '88dvh',
          borderRadius: '22px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.38)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Compact Modal Header */}
        <div
          style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #be123c, #e11d48)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🐞</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>
                  מוקד טיפול בתקלות משתמשים
                </h2>
                <span style={{ fontSize: '0.66rem', background: 'rgba(255,255,255,0.22)', padding: '1px 6px', borderRadius: '6px', fontWeight: 800 }}>
                  {APP_VERSION}
                </span>
              </div>
              <div style={{ fontSize: '0.71rem', opacity: 0.92 }}>
                מסלול טיפול: 1. צפייה בווידאו/קופסה שחורה ← 2. העתקה ל-AI וסימון "בטיפול" ← 3. סימון "טופל" ועדכון המשתמש
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={loadReports}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '5px 9px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
              title="רענן רשימה"
            >
              🔄 רענן
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.25)',
                border: 'none',
                color: '#ffffff',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                fontSize: '0.95rem',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="סגור חלון"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filter Bar (Single Horizontal Scrollable Row) */}
        <div
          style={{
            padding: '8px 14px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          {[
            { id: 'all', label: `הכל (${reports.length})` },
            { id: 'new', label: `🔴 חדשים (${reports.filter((r) => r.status === 'new').length})` },
            { id: 'in_progress', label: `🟡 בטיפול (${reports.filter((r) => r.status === 'in_progress').length})` },
            { id: 'resolved', label: `🟢 טופלו (${reports.filter((r) => r.status === 'resolved').length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id as any)}
              style={{
                background: filterStatus === tab.id ? '#be123c' : '#ffffff',
                color: filterStatus === tab.id ? '#ffffff' : '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '999px',
                padding: '4px 11px',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Reports List (display: block + flexShrink: 0 on cards so cards NEVER collapse or clip at the top!) */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 14px',
            background: '#f1f5f9'
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontWeight: 700 }}>
              טוען דיווחי תקלות...
            </div>
          ) : filteredReports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontWeight: 700 }}>
              אין דיווחי תקלות בקטגוריה זו.
            </div>
          ) : (
            filteredReports.map((rep) => {
              const cleanPhone = (rep.reporter?.phone || '').replace(/\D/g, '');
              const waPhone = cleanPhone.startsWith('0') ? `972${cleanPhone.slice(1)}` : cleanPhone;
              const waMessage =
                rep.status === 'resolved'
                  ? `שלום ${rep.reporter?.name || ''}, התקלה שדיווחת עליה ב-MySpace ("${rep.description.slice(0, 40)}") טופלה ותוקנה! תודה רבה על הדיווח.`
                  : `שלום ${rep.reporter?.name || ''}, קיבלנו את דיווח התקלה שלך ב-MySpace ("${rep.description.slice(0, 40)}") והעברנו אותה לטיפול. נעדכן אותך ברגע שתסתיים.`;

              return (
                <div
                  key={rep.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    padding: '14px',
                    marginBottom: '14px',
                    border: rep.status === 'new' ? '2px solid #f43f5e' : rep.status === 'in_progress' ? '2px solid #f59e0b' : '1.5px solid #86efac',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    flexShrink: 0
                  }}
                >
                  {/* 1. Reporter Identity & Location Header */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
                          👤 {rep.reporter?.name || 'אורח'}
                        </span>
                        <span dir="ltr" style={{ fontSize: '0.73rem', background: '#f1f5f9', padding: '2px 7px', borderRadius: '6px', color: '#334155', fontWeight: 700 }}>
                          📱 {rep.reporter?.phone || 'ללא טלפון'}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>
                        🕒 {new Date(rep.createdAt).toLocaleString('he-IL')}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.73rem', color: '#475569', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span>📍 <strong>מיקום:</strong> {rep.telemetry?.spaceTitle ? `מרחב "${rep.telemetry.spaceTitle}"` : rep.telemetry?.route}</span>
                      <span>•</span>
                      <span>🛠️ <strong>כלי:</strong> {rep.telemetry?.activeWidget || 'כללי'}</span>
                      <span>•</span>
                      <span>📱 <strong>מכשיר:</strong> {rep.telemetry?.deviceOS}</span>
                    </div>
                  </div>

                  {/* 2. User Bug Description */}
                  <div style={{ background: '#fff1f2', padding: '9px 12px', borderRadius: '10px', border: '1px solid #fecdd3', fontSize: '0.84rem', color: '#881337', fontWeight: 800, whiteSpace: 'pre-wrap' }}>
                    📝 תיאור התקלה: {rep.description}
                  </div>

                  {/* 3. Attached Screenshot and/or 35s Video */}
                  {(rep.videoUrl || (rep.mediaType === 'video' && rep.mediaUrl) || rep.screenshotUrl || (rep.mediaType === 'screenshot' && rep.mediaUrl)) && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                      {(rep.videoUrl || (rep.mediaType === 'video' && rep.mediaUrl)) && (
                        <div style={{ background: '#0f172a', borderRadius: '12px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                          <div style={{ color: '#94a3b8', fontSize: '0.71rem', alignSelf: 'flex-start' }}>
                            🎥 סרטון מסך מוקלט ({rep.mediaDurationSec || 0} שניות)
                          </div>
                          <video src={rep.videoUrl || rep.mediaUrl} controls style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '8px' }} />
                        </div>
                      )}
                      {(rep.screenshotUrl || (rep.mediaType === 'screenshot' && rep.mediaUrl)) && (
                        <div style={{ background: '#0f172a', borderRadius: '12px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                          <div style={{ color: '#94a3b8', fontSize: '0.71rem', alignSelf: 'flex-start' }}>
                            📸 צילום מסך שצורף לתקלה (לחץ להגדלה)
                          </div>
                          <a href={rep.screenshotUrl || rep.mediaUrl} target="_blank" rel="noopener noreferrer">
                            <img src={rep.screenshotUrl || rep.mediaUrl} alt="צילום תקלה" style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '8px', objectFit: 'contain' }} />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. Expandable Black-Box Chat & DOM Telemetry */}
                  <details style={{ fontSize: '0.74rem', color: '#475569', background: '#f8fafc', padding: '7px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 800 }}>
                      🔍 הצג קופסה שחורה (תמליל שיחה עם הסוכן + כפתורים שהיו על המסך)
                    </summary>
                    <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      <strong>תמליל שיחה אחרון עם הסוכן:</strong>
                      <div>{rep.chatContextSummary || 'ללא שיחה קודמת'}</div>
                      <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
                      <strong>כפתורים ורכיבים שהיו גלויים על המסך ברגע התקלה:</strong>
                      <div>{(rep.telemetry?.domSnapshot?.visibleButtonsAndActions || []).join(' | ') || 'לא נרשמו'}</div>
                    </div>
                  </details>

                  {/* 5. PROMINENT ADMIN WORKFLOW & ACTION BAR (Always visible at the bottom of every card!) */}
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    {/* Step A: 1-Tap Status Progression */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#334155' }}>
                        סטטוס טיפול בתקלה:
                      </span>
                      <div style={{ display: 'flex', gap: '5px', flex: 1, justifyContent: 'flex-end' }}>
                        {[
                          { id: 'new', label: '🔴 חדש', activeBg: '#be123c', lightBg: '#fff1f2', textColor: '#be123c' },
                          { id: 'in_progress', label: '🟡 בטיפול', activeBg: '#d97706', lightBg: '#fef3c7', textColor: '#b45309' },
                          { id: 'resolved', label: '🟢 טופל', activeBg: '#16a34a', lightBg: '#dcfce7', textColor: '#15803d' }
                        ].map((st) => {
                          const isCurrent = rep.status === st.id;
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => rep.id && handleStatusChange(rep.id, st.id as any)}
                              style={{
                                background: isCurrent ? st.activeBg : st.lightBg,
                                color: isCurrent ? '#ffffff' : st.textColor,
                                border: isCurrent ? `2px solid ${st.activeBg}` : '1px solid #cbd5e1',
                                borderRadius: '8px',
                                padding: '5px 10px',
                                fontSize: '0.74rem',
                                fontWeight: 900,
                                cursor: 'pointer',
                                boxShadow: isCurrent ? '0 2px 6px rgba(0,0,0,0.15)' : 'none'
                              }}
                            >
                              {st.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Step B: Admin Actions (Copy for AI Fix | Reply to User on WhatsApp | Delete Report) */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleCopyForAI(rep)}
                        style={{
                          flex: 1,
                          background: copiedReportId === rep.id ? '#dcfce7' : '#eff6ff',
                          color: copiedReportId === rep.id ? '#166534' : '#1d4ed8',
                          border: '1px solid #bfdbfe',
                          borderRadius: '8px',
                          padding: '6px 9px',
                          fontSize: '0.73rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                        title="העתק את כל המפרט הטכני של התקלה כדי להדביק לסוכן הפיתוח לתיקון מיידי"
                      >
                        {copiedReportId === rep.id ? '✅ הועתק ללוח!' : '📋 העתק דוח לתיקון ב-AI'}
                      </button>

                      {waPhone.length >= 9 && (
                        <a
                          href={`https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            flex: 1,
                            background: '#dcfce7',
                            color: '#166534',
                            border: '1px solid #86efac',
                            textDecoration: 'none',
                            borderRadius: '8px',
                            padding: '6px 9px',
                            fontSize: '0.73rem',
                            fontWeight: 800,
                            textAlign: 'center',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          💬 {rep.status === 'resolved' ? 'עדכן משתמש שטופל' : 'השב בוואטסאפ'}
                        </a>
                      )}

                      {confirmDeleteId === rep.id ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => rep.id && handleDelete(rep.id)}
                            style={{
                              background: '#dc2626',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '6px 10px',
                              fontSize: '0.73rem',
                              fontWeight: 900,
                              cursor: 'pointer'
                            }}
                          >
                            ⚠️ אשר מחיקה
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            style={{
                              background: '#e2e8f0',
                              color: '#334155',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '6px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            ביטול
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(rep.id || null)}
                          style={{
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            fontSize: '0.73rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          🗑️ מחק תקלה
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

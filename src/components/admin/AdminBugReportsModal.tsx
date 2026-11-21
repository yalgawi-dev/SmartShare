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
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
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
      if (expandedReportId === reportId) setExpandedReportId(null);
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

  const statusMeta = {
    new: { label: '🔴 חדש', bg: '#fff1f2', border: '#f43f5e', text: '#be123c', activeBg: '#be123c' },
    in_progress: { label: '🟡 בטיפול', bg: '#fef3c7', border: '#f59e0b', text: '#b45309', activeBg: '#d97706' },
    resolved: { label: '🟢 טופל', bg: '#dcfce7', border: '#22c55e', text: '#15803d', activeBg: '#16a34a' }
  };

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
                  רשימת תקלות משתמשים וסטטוס טיפול
                </h2>
                <span style={{ fontSize: '0.66rem', background: 'rgba(255,255,255,0.22)', padding: '1px 6px', borderRadius: '6px', fontWeight: 800 }}>
                  {APP_VERSION}
                </span>
              </div>
              <div style={{ fontSize: '0.71rem', opacity: 0.92 }}>
                לחץ על שורת תקלה ברשימה כדי לפתוח סרטון/תמונה, או שנה סטטוס ומחק ישירות מהשורה
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
            { id: 'all', label: `📋 כל הרשימה (${reports.length})` },
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

        {/* Scannable Master List of Bug Reports */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 12px',
            background: '#f1f5f9'
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontWeight: 700 }}>
              טוען רשימת תקלות...
            </div>
          ) : filteredReports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontWeight: 700 }}>
              אין תקלות ברשימה בקטגוריה זו.
            </div>
          ) : (
            filteredReports.map((rep, idx) => {
              const isExpanded = expandedReportId === rep.id;
              const st = statusMeta[rep.status] || statusMeta.new;
              const hasVideo = Boolean(rep.videoUrl || (rep.mediaType === 'video' && rep.mediaUrl));
              const hasScreenshot = Boolean(rep.screenshotUrl || (rep.mediaType === 'screenshot' && rep.mediaUrl));
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
                    borderRadius: '14px',
                    marginBottom: '10px',
                    border: isExpanded ? `2px solid ${st.border}` : `1.5px solid ${rep.status === 'new' ? '#fda4af' : '#cbd5e1'}`,
                    boxShadow: isExpanded ? '0 8px 20px rgba(0,0,0,0.08)' : '0 2px 5px rgba(0,0,0,0.03)',
                    overflow: 'hidden'
                  }}
                >
                  {/* COMPACT LIST ROW (Always visible so Admin sees all bugs and their status at a glance!) */}
                  <div
                    onClick={() => setExpandedReportId(isExpanded ? null : rep.id || null)}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      background: isExpanded ? '#fff1f2' : '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    {/* Row Line 1: Index + Description + Media Badges + Expand Arrow */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            background: '#0f172a',
                            color: '#ffffff',
                            borderRadius: '6px',
                            padding: '1px 6px',
                            fontSize: '0.70rem',
                            fontWeight: 900,
                            flexShrink: 0
                          }}
                        >
                          #{idx + 1}
                        </span>
                        <span
                          style={{
                            fontWeight: 900,
                            fontSize: '0.86rem',
                            color: '#0f172a',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {rep.description}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                        {hasVideo && (
                          <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 800 }}>
                            🎥 וידאו
                          </span>
                        )}
                        {hasScreenshot && (
                          <span style={{ background: '#fae8ff', color: '#86198f', padding: '2px 6px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 800 }}>
                            📸 תמונה
                          </span>
                        )}
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 800, paddingRight: '4px' }}>
                          {isExpanded ? '▲ סגור' : '▼ פרטים'}
                        </span>
                      </div>
                    </div>

                    {/* Row Line 2: Reporter Name + Space + Quick Status Pill Buttons + Quick Delete */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '6px',
                        paddingTop: '4px',
                        borderTop: '1px dashed #e2e8f0'
                      }}
                    >
                      <div style={{ fontSize: '0.72rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, color: '#1e293b' }}>👤 {rep.reporter?.name || 'אורח'}</span>
                        <span>•</span>
                        <span>📍 {rep.telemetry?.spaceTitle || 'דף ראשי'}</span>
                        <span>•</span>
                        <span>🕒 {new Date(rep.createdAt).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      {/* Direct 1-Tap Status Pills & Delete right on the List Row! */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {(['new', 'in_progress', 'resolved'] as const).map((statusKey) => {
                          const meta = statusMeta[statusKey];
                          const active = rep.status === statusKey;
                          return (
                            <button
                              key={statusKey}
                              type="button"
                              onClick={() => rep.id && handleStatusChange(rep.id, statusKey)}
                              style={{
                                background: active ? meta.activeBg : '#f8fafc',
                                color: active ? '#ffffff' : '#64748b',
                                border: active ? `1.5px solid ${meta.activeBg}` : '1px solid #cbd5e1',
                                borderRadius: '7px',
                                padding: '3px 7px',
                                fontSize: '0.69rem',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                            >
                              {meta.label}
                            </button>
                          );
                        })}

                        {confirmDeleteId === rep.id ? (
                          <button
                            type="button"
                            onClick={() => rep.id && handleDelete(rep.id)}
                            style={{
                              background: '#dc2626',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '7px',
                              padding: '3px 8px',
                              fontSize: '0.69rem',
                              fontWeight: 900,
                              cursor: 'pointer'
                            }}
                          >
                            ⚠️ אשר מחיקה
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(rep.id || null)}
                            style={{
                              background: '#fee2e2',
                              color: '#b91c1c',
                              border: '1px solid #fecaca',
                              borderRadius: '7px',
                              padding: '3px 7px',
                              fontSize: '0.70rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                            title="מחק תקלה זו"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* EXPANDED DETAILS PANEL (Opened when clicking a row in the list) */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: '12px',
                        borderTop: '1px solid #fecdd3',
                        background: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      {/* Full Description & Reporter Phone */}
                      <div style={{ background: '#fff1f2', padding: '9px 12px', borderRadius: '10px', border: '1px solid #fecdd3', fontSize: '0.82rem', color: '#881337', fontWeight: 700, whiteSpace: 'pre-wrap' }}>
                        <div>📝 <strong>תיאור מלא:</strong> {rep.description}</div>
                        <div style={{ marginTop: '4px', fontSize: '0.74rem', color: '#475569', fontWeight: 600 }}>
                          📱 טלפון מדווח: <span dir="ltr">{rep.reporter?.phone || 'ללא טלפון'}</span> | 🛠️ כלי: {rep.telemetry?.activeWidget || 'כללי'} | 📱 מכשיר: {rep.telemetry?.deviceOS} ({rep.telemetry?.screenSize})
                        </div>
                      </div>

                      {/* Attached Video and/or Screenshot */}
                      {(hasVideo || hasScreenshot) && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                          {hasVideo && (
                            <div style={{ background: '#0f172a', borderRadius: '12px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                              <div style={{ color: '#94a3b8', fontSize: '0.71rem', alignSelf: 'flex-start' }}>
                                🎥 סרטון מסך מוקלט ({rep.mediaDurationSec || 0} שניות)
                              </div>
                              <video src={rep.videoUrl || rep.mediaUrl} controls style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '8px' }} />
                            </div>
                          )}
                          {hasScreenshot && (
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

                      {/* Black-Box Telemetry */}
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

                      {/* Action Buttons inside Expanded View */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleCopyForAI(rep)}
                          style={{
                            flex: 1,
                            background: copiedReportId === rep.id ? '#dcfce7' : '#eff6ff',
                            color: copiedReportId === rep.id ? '#166534' : '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            borderRadius: '8px',
                            padding: '7px 10px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
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
                              padding: '7px 10px',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              textAlign: 'center'
                            }}
                          >
                            💬 {rep.status === 'resolved' ? 'עדכן משתמש שטופל' : 'השב בוואטסאפ'}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

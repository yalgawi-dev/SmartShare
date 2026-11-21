'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BugReportRecord,
  fetchAllBugReportsForAdmin,
  updateBugReportStatus,
  deleteBugReportRecord
} from '@/components/common/AssistantEngine/assistantBugReporter';

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
    if (!confirm('האם למחוק דיווח תקלה זה לצמיתות?')) return;
    try {
      await deleteBugReportRecord(reportId);
      setReports((prev) => {
        const updated = prev.filter((r) => r.id !== reportId);
        onCountChange?.(updated.filter((r) => r.status === 'new').length);
        return updated;
      });
    } catch (err) {
      console.error('Failed deleting bug report:', err);
    }
  };

  if (!isOpen) return null;

  const filteredReports = reports.filter((r) => (filterStatus === 'all' ? true : r.status === 'new' ? r.status === 'new' : r.status === filterStatus));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(6px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
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
          maxHeight: '88dvh',
          borderRadius: '24px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #be123c, #e11d48)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.5rem' }}>🐞</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900 }}>
                מוקד דיווחי תקלות משתמשים (מהסוכן האישי)
              </h2>
              <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>
                כולל פרטי המשתמש מהכרטיס, צילום מסך / סרטון 35 שניות וקופסה שחורה טכנית
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={loadReports}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: '#ffffff',
                borderRadius: '10px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              🔄 רענן
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: '#ffffff',
                borderRadius: '10px',
                padding: '6px 12px',
                fontSize: '1rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div
          style={{
            padding: '10px 20px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap'
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
                borderRadius: '10px',
                padding: '5px 12px',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Reports List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
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

              return (
                <div
                  key={rep.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    padding: '16px',
                    border: rep.status === 'new' ? '2px solid #f43f5e' : '1px solid #cbd5e1',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  {/* Top Row: User Info + Timestamp + Status Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
                          👤 {rep.reporter?.name || 'אורח'}
                        </span>
                        <span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', color: '#475569', fontWeight: 700 }}>
                          📱 {rep.reporter?.phone || 'ללא טלפון'}
                        </span>
                        {waPhone.length >= 9 && (
                          <a
                            href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`שלום ${rep.reporter?.name}, קיבלנו את דיווח התקלה שלך ב-MySpace ואנחנו מטפלים בה.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              background: '#dcfce7',
                              color: '#166534',
                              textDecoration: 'none',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.73rem',
                              fontWeight: 800
                            }}
                          >
                            💬 השב בוואטסאפ
                          </a>
                        )}
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          🕒 {new Date(rep.createdAt).toLocaleString('he-IL')}
                        </span>
                      </div>

                      {/* Telemetry Black-Box Row */}
                      <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '4px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <span>📍 <strong>מיקום:</strong> {rep.telemetry?.spaceTitle ? `מרחב "${rep.telemetry.spaceTitle}"` : rep.telemetry?.route}</span>
                        <span>🛠️ <strong>כלי:</strong> {rep.telemetry?.activeWidget || 'כללי'}</span>
                        <span>📱 <strong>מכשיר:</strong> {rep.telemetry?.deviceOS} ({rep.telemetry?.screenSize})</span>
                        <span>🏷️ <strong>גרסה:</strong> {rep.telemetry?.appVersion}</span>
                      </div>
                    </div>

                    {/* Status Selector & Delete */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <select
                        value={rep.status}
                        onChange={(e) => rep.id && handleStatusChange(rep.id, e.target.value as any)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          background: rep.status === 'new' ? '#fff1f2' : rep.status === 'in_progress' ? '#fef3c7' : '#dcfce7',
                          color: rep.status === 'new' ? '#be123c' : rep.status === 'in_progress' ? '#b45309' : '#166534'
                        }}
                      >
                        <option value="new">🔴 חדש</option>
                        <option value="in_progress">🟡 בטיפול</option>
                        <option value="resolved">🟢 טופל</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => rep.id && handleDelete(rep.id)}
                        style={{
                          background: '#fee2e2',
                          color: '#b91c1c',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '5px 8px',
                          fontSize: '0.78rem',
                          cursor: 'pointer'
                        }}
                        title="מחק דיווח"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* User Bug Description */}
                  <div style={{ background: '#fff1f2', padding: '10px 12px', borderRadius: '10px', border: '1px solid #fecdd3', fontSize: '0.86rem', color: '#881337', fontWeight: 700, whiteSpace: 'pre-wrap' }}>
                    📝 <strong>תיאור התקלה:</strong> {rep.description}
                  </div>

                  {/* Attached Screenshot and/or 35s Video */}
                  {(rep.videoUrl || (rep.mediaType === 'video' && rep.mediaUrl) || rep.screenshotUrl || (rep.mediaType === 'screenshot' && rep.mediaUrl)) && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                      {(rep.videoUrl || (rep.mediaType === 'video' && rep.mediaUrl)) && (
                        <div style={{ background: '#0f172a', borderRadius: '12px', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                          <div style={{ color: '#94a3b8', fontSize: '0.73rem', alignSelf: 'flex-start' }}>
                            🎥 סרטון מסך מוקלט ({rep.mediaDurationSec || 0} שניות)
                          </div>
                          <video src={rep.videoUrl || rep.mediaUrl} controls style={{ maxWidth: '100%', maxHeight: '320px', borderRadius: '8px' }} />
                        </div>
                      )}
                      {(rep.screenshotUrl || (rep.mediaType === 'screenshot' && rep.mediaUrl)) && (
                        <div style={{ background: '#0f172a', borderRadius: '12px', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                          <div style={{ color: '#94a3b8', fontSize: '0.73rem', alignSelf: 'flex-start' }}>
                            📸 צילום מסך שצורף לתקלה
                          </div>
                          <a href={rep.screenshotUrl || rep.mediaUrl} target="_blank" rel="noopener noreferrer">
                            <img src={rep.screenshotUrl || rep.mediaUrl} alt="צילום תקלה" style={{ maxWidth: '100%', maxHeight: '320px', borderRadius: '8px', objectFit: 'contain' }} />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expandable Black-Box Chat & DOM Telemetry */}
                  <details style={{ fontSize: '0.75rem', color: '#475569', background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
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
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

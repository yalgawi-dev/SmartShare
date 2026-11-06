"use client";
// @ts-nocheck

import { use, useState } from 'react';
import Link from 'next/link';
import { useSpaces } from '../../../context/SpacesContext';
import { useAuth } from '../../../context/AuthContext';
import { ExpenseDateReport } from '../../../../components/widgets/Finance/ExpenseDateReport';
import { ExpenseAnalyticsCharts } from '../../../../components/widgets/Finance/ExpenseAnalyticsCharts';
import { PartnerSettlementReport } from '../../../../components/widgets/Finance/PartnerSettlementReport';
import { AuditLogReport } from '../../../../components/widgets/Finance/AuditLogReport';
import { ReportsFloatingDock, ReportType } from '../../../../components/widgets/Finance/ReportsFloatingDock';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import styles from '../page.module.css';

export default function SpaceReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { spaces } = useSpaces();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const { user } = useAuth();
  
  // Navigation tabs within Reports: 'date_range' | 'analytics'
  const [activeTab, setActiveTab] = useState<ReportType>('date_range');

  const space = spaces.find(s => s.id === id);

  if (!space) {
    return <div className={styles.container}><h1>הפרויקט לא נמצא.</h1></div>;
  }

  const invoices = (space.invoices || []).filter(inv => inv.isActive !== false);

  return (
    <div className={styles.container} style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem', paddingBottom: '5rem' }}>
      {/* Top Compact Navigation & Title Bar */}
      <div style={{
        position: 'sticky',
        top: 0,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        zIndex: 100,
        padding: '0.75rem 0',
        marginBottom: '1rem',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            href={`/space/${id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'var(--bg-main, #f1f5f9)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-primary)',
              fontSize: '1.2rem',
              textDecoration: 'none',
              boxShadow: 'var(--shadow-sm)'
            }}
            title="חזרה למרחב"
          >
            ↩️
          </Link>
          <div>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.1rem, 3.5vw, 1.4rem)', color: 'var(--text-primary)', fontWeight: 800 }}>
              דוחות: {space.title}
            </h1>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              פילוח הוצאות וגרפים
            </p>
          </div>
        </div>

        {/* Tab Switcher Pills (Top Header Sync) */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-main, #f1f5f9)',
          padding: '0.2rem',
          borderRadius: '12px',
          border: '1px solid var(--border-light)',
          flexShrink: 0
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('date_range')}
            style={{
              padding: '0.4rem 0.65rem',
              borderRadius: '9px',
              border: 'none',
              background: activeTab === 'date_range' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'date_range' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 'bold',
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              transition: 'all 0.15s ease'
            }}
          >
            <span>📅</span>
            <span>פירוט הוצאות</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settlement')}
            style={{
              padding: '0.4rem 0.65rem',
              borderRadius: '9px',
              border: 'none',
              background: activeTab === 'settlement' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'settlement' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 'bold',
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              transition: 'all 0.15s ease'
            }}
          >
            <span>🤝</span>
            <span>התחשבנות שותפים</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            style={{
              padding: '0.4rem 0.65rem',
              borderRadius: '9px',
              border: 'none',
              background: activeTab === 'audit' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'audit' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 'bold',
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              transition: 'all 0.15s ease'
            }}
          >
            <span>📜</span>
            <span>יומן שינויים</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            style={{
              padding: '0.4rem 0.65rem',
              borderRadius: '9px',
              border: 'none',
              background: activeTab === 'analytics' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'analytics' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 'bold',
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              transition: 'all 0.15s ease'
            }}
          >
            <span>📈</span>
            <span>גרפים</span>
          </button>
        </div>
      </div>

      {/* Active Tab Content */}
      {activeTab === 'date_range' && (
        <ExpenseDateReport
          invoices={invoices}
          spaceTitle={space.title || 'פרויקט'}
          spaceId={id}
          onPreviewImage={(url) => setPreviewImage(url)}
        />
      )}

      {activeTab === 'settlement' && (
        <PartnerSettlementReport
          space={space}
          invoices={invoices}
          currentUserId={user?.id}
        />
      )}

      {activeTab === 'audit' && (
        <AuditLogReport
          space={space}
        />
      )}

      {activeTab === 'analytics' && (
        <ExpenseAnalyticsCharts
          invoices={invoices}
        />
      )}

      {/* FLOATING ACTION DOCK (MATCHING APP FLAGSHIP DOCK DESIGN) */}
      <ReportsFloatingDock
        spaceId={id}
        activeReport={activeTab}
        onSwitchReport={(tab) => setActiveTab(tab)}
        zipCount={invoices.filter((i: any) => i.hasAttachment || i.attachmentUrl).length}
      />

      {/* Full Screen Image Preview Modal */}
      {previewImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 999999, display: 'flex', flexDirection: 'column' }}>
          <button 
            type="button" 
            onClick={() => setPreviewImage(null)} 
            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(255, 255, 255, 0.2)', border: '2px solid white', color: 'white', width: '50px', height: '50px', borderRadius: '50%', fontSize: '1.5rem', cursor: 'pointer', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '3px' }}
            title="סגור תצוגה"
          >
            ✕
          </button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} onClick={() => setPreviewImage(null)}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', height: '100%' }}>
              <TransformWrapper initialScale={1} minScale={1} maxScale={5} centerOnInit={true}>
                <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', width: '100%' }}>
                    <img src={previewImage} style={{ maxWidth: '100%', maxHeight: '80%', objectFit: 'contain', margin: 'auto' }} />
                  </div>
                </TransformComponent>
              </TransformWrapper>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

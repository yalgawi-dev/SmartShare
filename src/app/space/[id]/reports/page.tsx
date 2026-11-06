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
import { ZipExportModal } from '../../../../components/widgets/Finance/ZipExportModal';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import styles from '../page.module.css';

export default function SpaceReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { spaces } = useSpaces();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showZipModal, setShowZipModal] = useState<boolean>(false);
  const { user } = useAuth();
  
  // Navigation tabs within Reports: 'date_range' | 'settlement' | 'audit' | 'analytics'
  const [activeTab, setActiveTab] = useState<ReportType>('date_range');

  const space = spaces.find(s => s.id === id);

  if (!space) {
    return <div className={styles.container}><h1>הפרויקט לא נמצא.</h1></div>;
  }

  const invoices = (space.invoices || []).filter(inv => inv.isActive !== false);

  return (
    <div className={styles.container} style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem', paddingBottom: '6rem' }}>
      {/* Top Compact Clean Header Bar (Single Source of Truth - Navigation is via Bottom Dock) */}
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
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#ffffff',
              border: '1px solid var(--border-light)',
              color: 'var(--text-primary)',
              fontSize: '1.25rem',
              textDecoration: 'none',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.15s ease'
            }}
            title="חזרה ללוח הראשי"
          >
            🏠
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ margin: 0, fontSize: 'clamp(1.1rem, 3.5vw, 1.4rem)', color: 'var(--text-primary)', fontWeight: 800 }}>
                דוחות: {space.title}
              </h1>
              <span style={{ fontSize: '0.65rem', background: '#e0e7ff', color: '#4338ca', padding: '1px 6px', borderRadius: '6px', fontWeight: 800 }}>
                v3.4.49
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              פילוח הוצאות, התחשבנות וגרפים
            </p>
          </div>
        </div>

        {/* Audit Log Switcher Button (Preserves capability without dock congestion) */}
        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'audit' ? 'date_range' : 'audit')}
          style={{
            background: activeTab === 'audit' ? 'var(--primary)' : 'rgba(59, 130, 246, 0.08)',
            border: activeTab === 'audit' ? 'none' : '1px solid #bfdbfe',
            color: activeTab === 'audit' ? '#ffffff' : '#1d4ed8',
            padding: '0.4rem 0.75rem',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            boxShadow: 'var(--shadow-sm)',
            flexShrink: 0
          }}
          title="יומן שינויים ופעולות"
        >
          <span>📜</span>
          <span style={{ whiteSpace: 'nowrap' }}>{activeTab === 'audit' ? 'חזרה לדוחות' : 'יומן שינויים'}</span>
        </button>
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
        onOpenZip={() => {
          if (activeTab === 'date_range') {
            window.dispatchEvent(new CustomEvent('smartshare:reports_open_zip'));
          } else {
            setShowZipModal(true);
          }
        }}
      />

      {/* Global Space ZIP Export Modal */}
      <ZipExportModal
        isOpen={showZipModal}
        onClose={() => setShowZipModal(false)}
        invoices={invoices}
        spaceTitle={space.title || 'מרחב'}
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

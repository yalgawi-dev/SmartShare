"use client";
// @ts-nocheck

import { use, useState } from 'react';
import Link from 'next/link';
import { useSpaces } from '../../../context/SpacesContext';
import { useAuth } from '../../../context/AuthContext';
import { ExpenseDateReport } from '../../../../components/widgets/Finance/ExpenseDateReport';
import { ExpenseAnalyticsCharts } from '../../../../components/widgets/Finance/ExpenseAnalyticsCharts';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import styles from '../page.module.css';

export default function SpaceReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { spaces } = useSpaces();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const { user } = useAuth();
  
  // Navigation tabs within Reports: 'date_range' | 'analytics'
  const [activeTab, setActiveTab] = useState<'date_range' | 'analytics'>('date_range');

  const space = spaces.find(s => s.id === id);

  if (!space) {
    return <div className={styles.container}><h1>הפרויקט לא נמצא.</h1></div>;
  }

  const invoices = (space.invoices || []).filter(inv => inv.isActive !== false);

  return (
    <div className={styles.container} style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Top Navigation Back Link */}
      <div style={{ position: 'sticky', top: 0, background: 'var(--bg-main, #f8fafc)', zIndex: 100, padding: '1rem 0', margin: '-1rem -1rem 1.5rem -1rem', paddingLeft: '1rem', paddingRight: '1rem', borderBottom: '1px solid var(--border-light)' }}>
        <Link href={`/space/${id}`} className={styles.backBtn} style={{ margin: 0 }}>
          <span>&rarr;</span> חזרה לקיר הפרויקט
        </Link>
      </div>

      {/* Main Header */}
      <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 className={styles.title} style={{ margin: 0, fontSize: '1.65rem' }}>
            📊 דוחות ומדדים פיננסיים: {space.title}
          </h1>
          <p className={styles.subtitle} style={{ margin: '0.35rem 0 0', opacity: 0.85 }}>
            פילוח הוצאות לפי תאריכים, גרפי השוואה וייצוא נתונים
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '0.3rem', borderRadius: '14px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
          <button
            onClick={() => setActiveTab('date_range')}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'date_range' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'date_range' ? '#ffffff' : 'var(--text-primary)',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <span>📅</span> דוח תאריכים וייצוא
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'analytics' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'analytics' ? '#ffffff' : 'var(--text-primary)',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <span>📈</span> גרפים והשוואות
          </button>
        </div>
      </header>

      {/* Active Tab Content */}
      {activeTab === 'date_range' && (
        <ExpenseDateReport
          invoices={invoices}
          spaceTitle={space.title || 'פרויקט'}
          onPreviewImage={(url) => setPreviewImage(url)}
        />
      )}

      {activeTab === 'analytics' && (
        <ExpenseAnalyticsCharts
          invoices={invoices}
        />
      )}

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
                  <img src={previewImage} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', margin: 'auto' }} />
                </TransformComponent>
              </TransformWrapper>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

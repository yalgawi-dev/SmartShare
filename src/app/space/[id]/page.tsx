'use client';

import { use, useState, useEffect } from 'react';
import styles from './page.module.css';
import Link from 'next/link';
import { useSpaces } from '../../context/SpacesContext';
import { getFeatureById, AVAILABLE_FEATURES } from '../../data/features';
import FinanceWidget from '../../../components/widgets/FinanceWidget';
import ScannerWidget from '../../../components/widgets/ScannerWidget';
import PartnersWidget from '../../../components/widgets/PartnersWidget';
import GuestbookWidget from '../../../components/widgets/GuestbookWidget';
import GalleryWidget from '../../../components/widgets/GalleryWidget';
import GenericWidget from '../../../components/widgets/GenericWidget';

function EmptyStateCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % AVAILABLE_FEATURES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const feature = AVAILABLE_FEATURES[currentIndex];

  return (
    <div className={`card glass-panel ${styles.emptyStateWrapper}`}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚀</div>
      <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>הקיר שלך מוכן!</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
        כעת כל שנותר הוא להרכיב את הקיר המרכזי של הפרויקט לפי הצרכים שלך.
      </p>
      
      <div className={styles.carouselCard}>
        <h4 className={styles.carouselTitle}>הכר את הפיצ'רים שלנו:</h4>
        <div className={styles.carouselContent}>
          <div className={styles.carouselIcon}>{feature.icon}</div>
          <div className={styles.carouselInfo}>
            <h5>{feature.name}</h5>
            <p>{feature.desc}</p>
          </div>
        </div>
        <div className={styles.carouselIndicators}>
          {AVAILABLE_FEATURES.map((_, idx) => (
            <span 
              key={idx} 
              className={`${styles.indicator} ${idx === currentIndex ? styles.activeIndicator : ''}`}
              onClick={() => setCurrentIndex(idx)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SpaceWallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { spaces, toggleFeature, updateSpaceTitle } = useSpaces();
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  
  const space = spaces.find(s => s.id === id);

  if (!space) {
    return <div className={styles.container}><h1>הפרויקט לא נמצא. יש לחזור לדף הבית ולהיכנס שוב.</h1></div>;
  }

  // Active features
  const hasFinance = space.features.includes('finance');
  const hasScanner = space.features.includes('scanner');
  const hasPartners = space.features.includes('partners');
  const hasGuestbook = space.features.includes('guestbook');
  const hasGallery = space.features.includes('gallery');
  
  // Find generic features (those that are active but aren't explicitly rendered)
  const explicitFeatures = ['finance', 'scanner', 'partners', 'guestbook', 'gallery'];
  const genericFeatures = space.features
    .filter(f => !explicitFeatures.includes(f))
    .map(f => getFeatureById(f))
    .filter(f => f !== undefined) as { id: string; name: string; desc: string; icon: string }[];

  // Simulated DB: 0 partners initially
  const activePartnersCount = 0; 

  const handleAddFeature = (featureId: string) => {
    toggleFeature(id, featureId);
  };

  const unusedFeatures = AVAILABLE_FEATURES.filter(f => !space.features.includes(f.id));

  return (
    <div className={styles.container} style={{ maxWidth: '1200px' }}>
      <Link href="/" className={styles.backBtn}>
        <span>&rarr;</span> חזרה ללוח הראשי
      </Link>

      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.icon}>{space.icon}</div>
          <div>
            {isEditingTitle ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input 
                  type="text" 
                  value={editTitleValue} 
                  onChange={(e) => setEditTitleValue(e.target.value)}
                  style={{ fontSize: '1.5rem', fontWeight: 'bold', border: '1px solid var(--primary)', borderRadius: '4px', padding: '0.2rem 0.5rem', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  autoFocus
                />
                <button onClick={() => {
                  if (editTitleValue.trim()) {
                    updateSpaceTitle(id, editTitleValue);
                  }
                  setIsEditingTitle(false);
                }} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}>שמור</button>
                <button onClick={() => setIsEditingTitle(false)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>ביטול</button>
              </div>
            ) : (
              <h1 className={styles.title} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {space.title}
                <button onClick={() => {
                  setEditTitleValue(space.title);
                  setIsEditingTitle(true);
                }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.6 }} title="ערוך שם מרחב">✏️</button>
              </h1>
            )}
            <p className={styles.subtitle}>{space.description} | <b>הקיר המרכזי (Wall)</b></p>
          </div>
        </div>
        
        {/* Settings button */}
        <Link href={`/space/${id}/settings`} style={{ 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border-light)', 
          padding: '0.5rem 1rem', 
          borderRadius: 'var(--radius-md)', 
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          textDecoration: 'none'
        }}>
          ⚙️ הגדרות מרחב
        </Link>
      </header>

      {/* The Unified Wall (Single Column Centered) */}
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Active Widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {hasPartners && <PartnersWidget activePartnersCount={activePartnersCount} onRemove={() => toggleFeature(id, 'partners')} />}
          {hasGallery && <GalleryWidget space={space} onRemove={() => toggleFeature(id, 'gallery')} />}
          {hasGuestbook && <GuestbookWidget space={space} onRemove={() => toggleFeature(id, 'guestbook')} />}
          {hasFinance && <FinanceWidget space={space} activePartnersCount={activePartnersCount} initialScannedImage={scannedImage} onRemove={() => toggleFeature(id, 'finance')} />}
          {hasScanner && <ScannerWidget onRemove={() => toggleFeature(id, 'scanner')} onScanComplete={(imgUrl) => setScannedImage(imgUrl)} />}

          {/* Render Generic Widgets */}
          {genericFeatures.map(feature => (
            <GenericWidget 
              key={feature.id}
              title={feature.name}
              description={feature.desc}
              icon={feature.icon}
              onRemove={() => toggleFeature(id, feature.id)}
            />
          ))}

          {space.features.length === 0 && (
            <EmptyStateCarousel />
          )}
        </div>

        {/* Widget Store / Add Features Section */}
        {unusedFeatures.length > 0 && (
          <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '2px dashed var(--border-light)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--text-primary)', textAlign: 'center' }}>
              🧩 חנות הווידג'טים - הוסף כלים לקיר
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
              {unusedFeatures.map(mod => (
                <div 
                  key={mod.id} 
                  style={{ 
                    cursor: 'pointer', 
                    border: '1px solid var(--border-light)', 
                    background: 'var(--bg-card)',
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-md)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center'
                  }}
                  onClick={() => handleAddFeature(mod.id)}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{mod.icon}</div>
                  <h4 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>{mod.name}</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>{mod.desc}</p>
                  
                  <button style={{ 
                    marginTop: 'auto',
                    width: '100%', 
                    padding: '0.5rem', 
                    background: 'rgba(59, 130, 246, 0.1)', 
                    color: 'var(--primary)', 
                    border: '1px solid var(--primary)', 
                    borderRadius: 'var(--radius-sm)', 
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'; e.currentTarget.style.color = 'var(--primary)'; }}
                  >
                    + הוסף לקיר
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

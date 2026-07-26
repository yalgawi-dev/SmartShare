'use client';

import { use, useState, useEffect } from 'react';
import styles from './page.module.css';
import Link from 'next/link';
import { useSpaces } from '../../context/SpacesContext';
import { getFeatureById, AVAILABLE_FEATURES } from '../../data/features';
import FinanceWidget from '../../../components/widgets/FinanceWidget';
import ScannerWidget from '../../../components/widgets/ScannerWidget';
import PartnersWidget from '../../../components/widgets/PartnersWidget';

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
  const { spaces, toggleFeature } = useSpaces();
  
  const space = spaces.find(s => s.id === id);

  if (!space) {
    return <div className={styles.container}><h1>הפרויקט לא נמצא.</h1></div>;
  }

  // Active features
  const hasFinance = space.features.includes('finance');
  const hasScanner = space.features.includes('scanner');
  const hasPartners = space.features.includes('partners');

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
            <h1 className={styles.title}>{space.title}</h1>
            <p className={styles.subtitle}>{space.description} | <b>הקיר המרכזי (Wall)</b></p>
          </div>
        </div>
      </header>

      {/* Two Column Layout for Wall */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem', alignItems: 'start' }}>
        
        {/* Main Wall Area (Left) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {hasPartners && <PartnersWidget activePartnersCount={activePartnersCount} />}
          {hasFinance && <FinanceWidget space={space} activePartnersCount={activePartnersCount} />}
          {hasScanner && <ScannerWidget />}

          {space.features.length === 0 && (
            <EmptyStateCarousel />
          )}
        </div>

        {/* Sidebar Dock (Right) */}
        <div style={{ position: 'sticky', top: '2rem', padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
          <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem', color: 'var(--text-primary)' }}>🛠️ כלים זמינים להוספה:</h3>
          {unusedFeatures.length === 0 ? (
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>הוספת את כל הכלים הזמינים!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {unusedFeatures.map(mod => (
                <div 
                  key={mod.id} 
                  style={{ 
                    cursor: 'pointer', 
                    border: '1px solid var(--border-light)', 
                    background: 'rgba(0,0,0,0.02)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                  onClick={() => handleAddFeature(mod.id)}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    <div style={{ fontSize: '1.5rem' }}>{mod.icon}</div>
                    <h4 style={{ fontSize: '1rem', margin: 0 }}>{mod.name}</h4>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, paddingRight: '2.25rem' }}>{mod.desc}</p>
                  
                  <button style={{ 
                    marginTop: '0.75rem', 
                    width: '100%', 
                    padding: '0.4rem', 
                    background: 'var(--primary)', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: 'var(--radius-sm)', 
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}>
                    + הוסף לקיר
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

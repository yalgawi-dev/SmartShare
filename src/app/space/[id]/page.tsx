'use client';

import { use, useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import Link from 'next/link';
import { useSpaces } from '../../context/SpacesContext';
import { useAuth } from '../../context/AuthContext';
import { getFeatureById, AVAILABLE_FEATURES } from '../../data/features';
import FinanceWidget from '../../../components/widgets/FinanceWidget';
import ScannerWidget from '../../../components/widgets/ScannerWidget';
import PartnersWidget from '../../../components/widgets/PartnersWidget';
import GuestbookWidget from '../../../components/widgets/GuestbookWidget';
import GalleryWidget from '../../../components/widgets/GalleryWidget';
import GenericWidget from '../../../components/widgets/GenericWidget';
import InviteModal from '../../../components/widgets/InviteModal';
import TopGuestsWidget from '../../../components/widgets/TopGuestsWidget';
import GuestOnboardingModal from '../../../components/widgets/GuestOnboardingModal';
import { compressImage } from '../../../utils/imageOptimizer';

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
  // Using simple window location to avoid next/navigation async issues for a quick demo
  const isGuestMode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('role') === 'guest' : false;
  
  const { spaces, toggleFeature, updateSpaceTitle, updateSpaceDate, updateSpaceCover, joinSpace } = useSpaces();
  const { user } = useAuth();
  
  // Auto-join space
  useEffect(() => {
    if (user && id) {
      joinSpace(id, user.id, user.realName || user.nickname || 'אורח');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, id]);

  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editDateValue, setEditDateValue] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localAvatarRef = useRef<HTMLInputElement>(null);
  
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

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 1920, 1080, 0.8);
        updateSpaceCover(id, compressed);
      } catch (err) {
        console.error('Failed to upload cover', err);
        alert('שגיאה בהעלאת תמונת השער');
      }
    }
  };

  const handleLocalAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      try {
        const compressed = await compressImage(file, 400, 400, 0.8);
        updateMemberPermissions(id, user.id, { localAvatarUrl: compressed });
      } catch (err) {
        console.error('Failed to upload local avatar', err);
        alert('שגיאה בהעלאת התמונה');
      }
    }
  };

  const spaceMember = space.members?.find((m: any) => m.userId === user?.id);
  const displayAvatar = spaceMember?.localAvatarUrl || user?.avatarUrl;

  return (
    <div className={styles.container} style={{ maxWidth: '1200px' }}>
      {isGuestMode && <GuestOnboardingModal />}
      
      <Link href="/" className={styles.backBtn}>
        <span>&rarr;</span> חזרה ללוח הראשי
      </Link>

      <header className={styles.header} style={{ 
        position: 'relative', 
        overflow: 'hidden', 
        padding: space.coverImage ? '2rem' : '2rem',
        minHeight: space.coverImage ? '350px' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        color: space.coverImage ? 'white' : 'inherit',
        textShadow: space.coverImage ? '0 2px 4px rgba(0,0,0,0.5)' : 'none'
      }}>
        {space.coverImage && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'hidden' }}>
            {/* Blurred Background */}
            <div style={{
              position: 'absolute', top: '-10%', left: '-10%', right: '-10%', bottom: '-10%',
              backgroundImage: `url(${space.coverImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(20px)',
              opacity: 0.6,
              zIndex: 1
            }}></div>
            {/* Actual Image */}
            <img src={space.coverImage} alt="Cover" style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', objectFit: 'contain' }} />
            {/* Dark Gradient Overlay for text readability */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.8) 100%)', zIndex: 3 }}></div>
          </div>
        )}
        
        <div className={styles.titleArea} style={{ position: 'relative', zIndex: 1, marginTop: space.coverImage ? 'auto' : '0' }}>
          <div 
            className={styles.icon} 
            style={{ background: space.coverImage ? 'rgba(255,255,255,0.2)' : 'var(--bg-card)', cursor: 'pointer', overflow: 'hidden', padding: displayAvatar ? '0' : '0.5rem 1rem', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => localAvatarRef.current?.click()}
            title="לחץ כדי לשנות את תמונת הפרופיל שלך במרחב זה"
          >
            {displayAvatar ? (
              <img src={displayAvatar} alt="My Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '2.5rem' }}>
                {user?.gender === 'male' ? '👦' : user?.gender === 'female' ? '👧' : '👤'}
              </span>
            )}
          </div>
          <input type="file" accept="image/*" ref={localAvatarRef} onChange={handleLocalAvatarUpload} style={{ display: 'none' }} />
          <div>
            {isEditingTitle ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input 
                  type="text" 
                  value={editTitleValue} 
                  onChange={(e) => setEditTitleValue(e.target.value)}
                  style={{ fontSize: '1.5rem', fontWeight: 'bold', border: '1px solid var(--primary)', borderRadius: '4px', padding: '0.2rem 0.5rem', background: 'white', color: 'black' }}
                  autoFocus
                />
                <button onClick={() => {
                  if (editTitleValue.trim()) {
                    updateSpaceTitle(id, editTitleValue);
                  }
                  setIsEditingTitle(false);
                }} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}>שמור</button>
                <button onClick={() => setIsEditingTitle(false)} style={{ background: 'rgba(255,255,255,0.3)', color: 'inherit', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}>ביטול</button>
              </div>
            ) : (
              <h1 className={styles.title} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'inherit' }}>
                {space.title}
                <button onClick={() => {
                  setEditTitleValue(space.title);
                  setIsEditingTitle(true);
                }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.8, color: 'inherit' }} title="ערוך שם מרחב">✏️</button>
              </h1>
            )}
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.9, marginTop: '0.25rem' }}>
              {isEditingDate ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input 
                    type="date" 
                    value={editDateValue} 
                    onChange={(e) => setEditDateValue(e.target.value)}
                    style={{ padding: '0.2rem', borderRadius: '4px', border: 'none' }}
                  />
                  <button onClick={() => { updateSpaceDate(id, editDateValue); setIsEditingDate(false); }} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>✓</button>
                </div>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  📅 {space.date ? new Date(space.date).toLocaleDateString('he-IL') : 'הגדר תאריך'}
                  <button onClick={() => { setEditDateValue(space.date || ''); setIsEditingDate(true); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem', opacity: 0.7, color: 'inherit' }}>✏️</button>
                </span>
              )}
              <span style={{ margin: '0 0.5rem' }}>|</span>
              <b>הקיר המרכזי</b>
            </div>
          </div>
        </div>
        
        {/* Settings and Cover buttons (Hidden for guests) */}
        {!isGuestMode && (
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button onClick={() => setShowInvite(true)} style={{ 
              background: 'var(--primary)', 
              border: 'none', 
              padding: '0.5rem 1rem', 
              borderRadius: 'var(--radius-md)', 
              color: 'white',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}>
              💌 הזמן אורחים
            </button>
            <button onClick={() => fileInputRef.current?.click()} style={{ 
              background: 'rgba(255,255,255,0.2)', 
              border: '1px solid rgba(255,255,255,0.3)', 
              padding: '0.5rem 1rem', 
              borderRadius: 'var(--radius-md)', 
              color: 'inherit',
              cursor: 'pointer'
            }}>
              🖼️ שנה תמונת שער
            </button>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleCoverUpload} style={{ display: 'none' }} />
            
            <Link href={`/space/${id}/settings`} style={{ 
              background: 'rgba(255,255,255,0.2)', 
              border: '1px solid rgba(255,255,255,0.3)', 
              padding: '0.5rem 1rem', 
              borderRadius: 'var(--radius-md)', 
              color: 'inherit',
              textDecoration: 'none'
            }}>
              ⚙️ הגדרות מרחב
            </Link>
          </div>
        )}
      </header>

      {/* The Unified Wall (Single Column Centered) */}
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Gamification / Wall of Fame */}
        <TopGuestsWidget space={space} />

        {/* Active Widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {hasPartners && !isGuestMode && <PartnersWidget space={space} onRemove={() => toggleFeature(id, 'partners')} />}
          {hasGallery && <GalleryWidget space={space} onRemove={!isGuestMode ? () => toggleFeature(id, 'gallery') : undefined} isGuestMode={isGuestMode} />}
          {hasFinance && !isGuestMode && <FinanceWidget space={space} activePartnersCount={activePartnersCount} initialScannedImage={scannedImage} onRemove={() => toggleFeature(id, 'finance')} />}
          {hasGuestbook && <GuestbookWidget space={space} onRemove={!isGuestMode ? () => toggleFeature(id, 'guestbook') : undefined} isGuestMode={isGuestMode} />}
          {hasScanner && !isGuestMode && <ScannerWidget onRemove={() => toggleFeature(id, 'scanner')} onScanComplete={(imgUrl) => setScannedImage(imgUrl)} />}

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
        
        {/* Widget Store - Hidden for guests */}
        {!isGuestMode && unusedFeatures.length > 0 && (
          <div style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px dashed var(--border-light)' }}>
            <h3 style={{ marginBottom: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              ➕ הוסף תכונות נוספות לקיר
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

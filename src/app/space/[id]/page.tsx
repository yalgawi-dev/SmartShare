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
import AlbumWidget from '../../../components/widgets/AlbumWidget';
import GalleryWidget from '../../../components/widgets/GalleryWidget';
import GenericWidget from '../../../components/widgets/GenericWidget';
import InviteModal from '../../../components/widgets/InviteModal';
import TopGuestsWidget from '../../../components/widgets/TopGuestsWidget';
import GuestOnboardingModal from '../../../components/widgets/GuestOnboardingModal';
import { compressImage } from '../../../utils/imageOptimizer';
import { uploadImageToStorage } from '@/lib/firebase';

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
        הוסף פיצ'רים מתפריט "➕ הוסף כלים" למעלה.
      </p>
    </div>
  );
}

export default function SpaceWallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isGuestMode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('role') === 'guest' : false;
  
  const { spaces, isLoaded, toggleFeature, updateSpaceTitle, updateSpaceDate, updateSpaceCover, joinSpace } = useSpaces();
  const { user } = useAuth();
  
  useEffect(() => {
    if (user && id) {
      joinSpace(id, user.id, user.realName || user.nickname || 'אורח');
    }
  }, [user?.id, id]);

  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editDateValue, setEditDateValue] = useState('');
  
  const [showInvite, setShowInvite] = useState(false);
  const [showFeatureMenu, setShowFeatureMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const space = spaces.find(s => s.id === id);

  if (!isLoaded) return <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><h2>טוען מרחב...</h2></div>;
  if (!space) return <div className={styles.container}><h1>המרחב לא נמצא.</h1></div>;

  const hasFinance = space.features.includes('finance');
  const hasScanner = space.features.includes('scanner');
  const hasPartners = space.features.includes('partners');
  const hasGuestbook = space.features.includes('guestbook');
  const hasGallery = space.features.includes('gallery');
  
  const explicitFeatures = ['finance', 'scanner', 'partners', 'guestbook', 'gallery'];
  const genericFeatures = space.features
    .filter(f => !explicitFeatures.includes(f))
    .map(f => getFeatureById(f))
    .filter(f => f !== undefined) as { id: string; name: string; desc: string; icon: string }[];

  const activePartnersCount = 0; 
  const unusedFeatures = AVAILABLE_FEATURES.filter(f => !space.features.includes(f.id));

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddFeature = (featureId: string, featureName: string) => {
    toggleFeature(id, featureId);
    setShowFeatureMenu(false);
    showToast(`נוסף בהצלחה: ${featureName}`);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        showToast('מעלה תמונה, אנא המתן...');
        const compressed = await compressImage(file, 1920, 1080, 0.8);
        const path = `spaces/covers/${id}_${Date.now()}.jpg`;
        const url = await uploadImageToStorage(compressed, path);
        updateSpaceCover(id, url);
        showToast('תמונת השער עודכנה בהצלחה!');
      } catch (err) {
        console.error('Failed to upload cover', err);
        showToast('שגיאה בהעלאת תמונת השער');
      }
    }
  };

  return (
    <div className={styles.container} style={{ maxWidth: '1200px' }}>
      {isGuestMode && <GuestOnboardingModal />}
      
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{ position: 'fixed', top: '2rem', left: '50%', transform: 'translateX(-50%)', background: '#10b981', color: 'white', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-full)', zIndex: 1000, boxShadow: 'var(--shadow-lg)', fontWeight: 'bold', animation: 'fadeIn 0.3s ease-out' }}>
          ✓ {toastMessage}
        </div>
      )}

      {/* Top Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <Link href="/" className={styles.backBtn} style={{ margin: 0 }}>
          <span>&rarr;</span> ללוח הראשי
        </Link>
        {!isGuestMode && (
          <button onClick={() => setShowFeatureMenu(true)} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
            ➕ הוסף כלים
          </button>
        )}
      </div>

      {/* Compact Header */}
      <header className={`card glass-panel`} style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          
          {/* Circular Cover/Avatar */}
          <div 
            style={{ 
              width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-main)', 
              boxShadow: 'var(--shadow-md)', border: '2px solid var(--border-light)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: !isGuestMode ? 'pointer' : 'default', flexShrink: 0, position: 'relative'
            }}
            onClick={() => !isGuestMode && fileInputRef.current?.click()}
            title={!isGuestMode ? "שנה תמונת שער" : ""}
          >
            {space.coverImage ? (
              <img src={space.coverImage} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '2.5rem' }}>{space.icon || '🏠'}</span>
            )}
            {!isGuestMode && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '0.7rem', textAlign: 'center', padding: '0.2rem 0' }}>
                ערוך
              </div>
            )}
          </div>
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleCoverUpload} style={{ display: 'none' }} />
          
          {/* Title & Date (Click to Edit) */}
          <div style={{ flex: 1 }}>
            {isEditingTitle && !isGuestMode ? (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input 
                  type="text" value={editTitleValue} onChange={(e) => setEditTitleValue(e.target.value)}
                  style={{ fontSize: '1.5rem', fontWeight: 'bold', border: '1px solid var(--primary)', borderRadius: '8px', padding: '0.2rem 0.5rem', width: '100%', maxWidth: '300px' }}
                  autoFocus
                />
                <button onClick={() => { if(editTitleValue.trim()) updateSpaceTitle(id, editTitleValue); setIsEditingTitle(false); }} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0 1rem', borderRadius: '8px', cursor: 'pointer' }}>✓</button>
              </div>
            ) : (
              <h1 
                onClick={() => { if(!isGuestMode) { setEditTitleValue(space.title); setIsEditingTitle(true); } }} 
                style={{ margin: '0 0 0.25rem 0', fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-primary)', cursor: !isGuestMode ? 'pointer' : 'default' }}
                title={!isGuestMode ? "לחץ לעריכה" : ""}
              >
                {space.title}
              </h1>
            )}

            {isEditingDate && !isGuestMode ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="date" value={editDateValue} onChange={(e) => setEditDateValue(e.target.value)}
                  style={{ padding: '0.2rem 0.5rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}
                />
                <button onClick={() => { updateSpaceDate(id, editDateValue); setIsEditingDate(false); }} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0 1rem', borderRadius: '8px', cursor: 'pointer' }}>✓</button>
              </div>
            ) : (
              <p 
                onClick={() => { if(!isGuestMode) { setEditDateValue(space.date || ''); setIsEditingDate(true); } }}
                style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem', cursor: !isGuestMode ? 'pointer' : 'default' }}
                title={!isGuestMode ? "לחץ לעריכה" : ""}
              >
                📅 {space.date ? new Date(space.date).toLocaleDateString('he-IL') : 'הגדר תאריך'} • <b>הקיר המרכזי</b>
              </p>
            )}
          </div>
        </div>

        {/* Action Chips */}
        {!isGuestMode && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-light)', paddingTop: '1.25rem' }}>
            <button onClick={() => setShowInvite(true)} style={{ background: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)', border: '1px solid rgba(79, 70, 229, 0.2)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              💌 הוסף אנשים
            </button>
            <Link href={`/space/${id}/settings`} style={{ background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: '500', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ⚙️ הגדרות מרחב
            </Link>
          </div>
        )}
      </header>

      {/* Feature Menu Modal (Bottom Sheet) */}
      {showFeatureMenu && (
        <>
          <div className="bottom-sheet-overlay" onClick={() => setShowFeatureMenu(false)}></div>
          <div className="bottom-sheet" style={{ zIndex: 1001, padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.5rem' }}>➕ כלים ותוספות</h3>
              <button onClick={() => setShowFeatureMenu(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>
            
            {unusedFeatures.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>כל הפיצ'רים כבר פעילים במרחב זה!</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {unusedFeatures.map(mod => (
                  <div key={mod.id} onClick={() => handleAddFeature(mod.id, mod.name)} style={{ border: '1px solid var(--border-light)', borderRadius: '16px', padding: '1.25rem', cursor: 'pointer', display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--bg-main)', transition: 'transform 0.2s' }}>
                    <div style={{ fontSize: '2rem', flexShrink: 0 }}>{mod.icon}</div>
                    <div>
                      <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>{mod.name}</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{mod.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* The Unified Wall (Single Column Centered) */}
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Gamification / Wall of Fame */}
        <TopGuestsWidget space={space} />

        {/* Active Widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {hasPartners && !isGuestMode && <PartnersWidget space={space} onRemove={() => toggleFeature(id, 'partners')} />}
          {hasGallery && <GalleryWidget space={space} onRemove={!isGuestMode ? () => toggleFeature(id, 'gallery') : undefined} isGuestMode={isGuestMode} />}
          {hasFinance && !isGuestMode && <FinanceWidget space={space} activePartnersCount={activePartnersCount} initialScannedImage={scannedImage} onRemove={() => toggleFeature(id, 'finance')} />}
          {hasGuestbook && <AlbumWidget space={space} isGuestMode={isGuestMode} onRemove={!isGuestMode ? () => toggleFeature(id, 'guestbook') : undefined} />}
          
          {/* Scanner Widget - No remove button for templates, pass undefined if template */}
          {hasScanner && !isGuestMode && (
            <ScannerWidget 
              onRemove={space.templateId ? undefined : () => toggleFeature(id, 'scanner')} 
              onScanComplete={(imgUrl) => setScannedImage(imgUrl)} 
            />
          )}

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
      </div>
      
      {showInvite && <InviteModal spaceId={id} onClose={() => setShowInvite(false)} />}
    </div>
  );
}

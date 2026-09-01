'use client';

import React, { useState, useRef } from 'react';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';
import { compressImage } from '../../utils/imageOptimizer';
import { uploadImageToStorage } from '@/lib/firebase';
import ProfileModal from './ProfileModal';
import CommentsModal from './CommentsModal';

export default function GalleryWidget({ space, onRemove, isGuestMode }: { space: any, onRemove?: () => void, isGuestMode?: boolean }) {
  const { addMediaItem, removeMediaItem, likeMediaItem } = useSpaces();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'photo' | 'video'>('photo');
  
  // Selection Mode (Bulk Download)
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Profile Inspection
  const [inspectedProfile, setInspectedProfile] = useState<any | null>(null);
  
  const spaceMember = space.members?.find((m: any) => m.userId === user?.id);
  const canUpload = user?.isAdmin || !isGuestMode || (spaceMember?.canUpload ?? true);
  
  // Resolve identity based on global or space-level overrides
  const useNicknameGlobally = user?.hideRealName || false;
  const useNickname = spaceMember?.useNickname !== undefined ? spaceMember.useNickname : useNicknameGlobally;
  const displayName = useNickname && user?.nickname ? user.nickname : (user?.realName || user?.nickname || 'אורח/ת');
  const displayAvatar = spaceMember?.localAvatarUrl || user?.avatarUrl;
  
  // Comments Modal
  const [openedMediaId, setOpenedMediaId] = useState<string | null>(null);
  
  const allMedia = space.mediaItems || [];
  const photos = allMedia.filter((m: any) => m.type === 'photo');
  const videos = allMedia.filter((m: any) => m.type === 'video');
  const displayedMedia = (activeTab === 'photo' ? photos : videos).sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        let finalUrl = '';
        
        // Handle Video (Check duration limit ~ 2 mins)
        if (file.type.startsWith('video/')) {
          if (file.size > 50 * 1024 * 1024) { // Arbitrary 50MB size limit for safety
             alert('הסרטון גדול מדי. אנא העלה סרטון קצר יותר (עד 50MB).');
             return;
          }
          // Note: Full duration checking requires loading video metadata. For now we use size as a proxy and allow video tags.
          // TO-DO: Video should also go to Storage eventually, but for now we skip or just upload
          finalUrl = URL.createObjectURL(file);
        } else {
          // Handle Image with compression
          const compressed = await compressImage(file, 1200, 1200, 0.8);
          const path = `spaces/gallery/${space.id}_${Date.now()}.jpg`;
          finalUrl = await uploadImageToStorage(compressed, path);
        }

        addMediaItem(space.id, {
          type: file.type.startsWith('video/') ? 'video' : 'photo',
          url: finalUrl,
          authorName: displayName,
          avatarUrl: displayAvatar,
          authorStatus: user?.status || undefined,
        });
      } catch (err) {
        console.error('Failed to process media', err);
        alert('שגיאה בעיבוד הקובץ');
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handleMediaClick = (photo: any) => {
    if (isSelectMode) {
      const newSet = new Set(selectedItems);
      if (newSet.has(photo.id)) newSet.delete(photo.id);
      else newSet.add(photo.id);
      setSelectedItems(newSet);
    } else {
      setOpenedMediaId(photo.id);
    }
  };

  const handleBulkDownload = () => {
    selectedItems.forEach(id => {
      const item = allMedia.find((m: any) => m.id === id);
      if (item?.url) {
        const a = document.createElement('a');
        a.href = item.url;
        a.download = `event-${item.type}-${item.id}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    });
    setIsSelectMode(false);
    setSelectedItems(new Set());
  };

  return (
    <div className="card glass-panel" style={{ padding: '2rem', marginBottom: '2rem', background: 'var(--bg-card)', position: 'relative' }}>
      
      {inspectedProfile && (
        <ProfileModal 
          profile={inspectedProfile} 
          onClose={() => setInspectedProfile(null)} 
        />
      )}
      
      {openedMediaId && (
        <CommentsModal 
          spaceId={space.id} 
          photo={allMedia.find((m: any) => m.id === openedMediaId)} 
          onClose={() => setOpenedMediaId(null)} 
        />
      )}
      
      {/* Hidden file input for camera/gallery */}
      <input 
        type="file" 
        accept="image/*,video/mp4,video/quicktime" 
        capture="environment" 
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }} 
      />

      {/* Header and Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              📸 הגלריה החיה
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              צלמו והעלו רגעים בלייב מהאירוע!
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {displayedMedia.length > 0 && (
            <button 
              onClick={() => { setIsSelectMode(!isSelectMode); setSelectedItems(new Set()); }}
              style={{ background: isSelectMode ? 'var(--primary)' : 'rgba(0,0,0,0.05)', color: isSelectMode ? 'white' : 'var(--text-primary)', border: 'none', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <span>{isSelectMode ? 'ביטול בחירה' : '✔️ בחר תמונות'}</span>
            </button>
          )}
          {canUpload && (
            <button 
              onClick={handleCameraClick}
              style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <span>+ צלם/העלה</span>
            </button>
          )}
          {onRemove && (
            <button onClick={onRemove} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.25rem' }} title="הסר פיצ'ר מהקיר">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)' }}>
        <button 
          onClick={() => setActiveTab('photo')}
          style={{ background: 'none', border: 'none', padding: '0.5rem 1rem', borderBottom: activeTab === 'photo' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'photo' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'photo' ? 'bold' : 'normal', cursor: 'pointer' }}
        >
          תמונות ({photos.length})
        </button>
        <button 
          onClick={() => setActiveTab('video')}
          style={{ background: 'none', border: 'none', padding: '0.5rem 1rem', borderBottom: activeTab === 'video' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'video' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'video' ? 'bold' : 'normal', cursor: 'pointer' }}
        >
          סרטונים ({videos.length})
        </button>
      </div>

      {/* Photos Masonry/Grid */}
      {displayedMedia.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>{activeTab === 'photo' ? '📷' : '🎥'}</div>
          <p>אין כאן {activeTab === 'photo' ? 'תמונות' : 'סרטונים'} עדיין.</p>
          <p style={{ fontSize: '0.9rem' }}>תהיו הראשונים לשתף רגע מעניין!</p>
          {canUpload && (
            <button 
              onClick={handleCameraClick}
              style={{ marginTop: '1.5rem', background: 'var(--text-primary)', color: 'var(--bg-primary)', border: 'none', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer' }}
            >
              פתח מצלמה
            </button>
          )}
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
          gap: '1rem',
          alignItems: 'start'
        }}>
          {displayedMedia.map((photo: any) => (
            <div 
              key={photo.id} 
              onClick={() => handleMediaClick(photo)}
              style={{ 
                borderRadius: 'var(--radius-md)', 
                overflow: 'hidden', 
                boxShadow: selectedItems.has(photo.id) ? '0 0 0 4px var(--primary)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                position: 'relative',
                aspectRatio: activeTab === 'photo' ? '1' : '9/16', // Videos are taller
                background: '#f0f0f0',
                cursor: 'pointer',
                transform: selectedItems.has(photo.id) ? 'scale(0.98)' : 'scale(1)',
                transition: 'all 0.2s ease'
              }}
            >
              {selectedItems.has(photo.id) && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10, background: 'var(--primary)', color: 'white', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                  ✓
                </div>
              )}
              {photo.type === 'video' ? (
                <video 
                  src={photo.url} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  controls
                />
              ) : (
                <img 
                  src={photo.url} 
                  alt="Live event photo" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              )}
              
              {/* Actions Overlay */}
              <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                {(!user || photo.authorName !== (user.nickname || user.realName)) && (
                  <a href={photo.url} download={`event-${photo.type}-${photo.id}`} style={{ background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textDecoration: 'none', fontSize: '0.9rem' }} title="שמור למכשיר">
                    ⬇️
                  </a>
                )}
                {(!isGuestMode || spaceMember?.canDelete || user?.isAdmin) && (
                  <button onClick={(e) => { e.stopPropagation(); removeMediaItem(space.id, photo.id); }} style={{ background: 'rgba(255,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.9rem' }} title="מחק (מנהל)">
                    🗑️
                  </button>
                )}
              </div>
              <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); likeMediaItem(space.id, photo.id); }} 
                  style={{ background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '20px', padding: '0.25rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}
                >
                  ❤️ {photo.likes || 0}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setOpenedMediaId(photo.id); }} 
                  style={{ background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '20px', padding: '0.25rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}
                >
                  💬 {photo.comments?.length || 0}
                </button>
              </div>
              <div style={{ 
                position: 'absolute', 
                bottom: 0, 
                left: 0, 
                right: 0, 
                padding: '2rem 0.5rem 0.5rem', 
                background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                color: 'white',
                fontSize: '0.8rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setInspectedProfile({
                      name: photo.authorName,
                      avatarUrl: photo.avatarUrl,
                      status: photo.authorStatus,
                      isCurrentUser: (user?.realName || user?.nickname) === photo.authorName
                    });
                  }}
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {photo.avatarUrl ? (
                      <img 
                        src={photo.avatarUrl} 
                        alt="Avatar" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const fallback = document.createElement('span');
                          fallback.innerHTML = user?.gender === 'male' ? '👦' : user?.gender === 'female' ? '👧' : '👤';
                          (e.target as HTMLImageElement).parentElement?.appendChild(fallback);
                        }}
                      />
                    ) : (user?.gender === 'male' ? '👦' : user?.gender === 'female' ? '👧' : '👤')}
                  </div>
                  <span style={{ fontWeight: 'bold' }}>{photo.authorName}</span>
                </div>
                <span>{photo.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk Download Action Bar */}
      {isSelectMode && selectedItems.size > 0 && (
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          background: 'white', padding: '1rem 2rem', borderRadius: 'var(--radius-full)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)', zIndex: 100,
          display: 'flex', alignItems: 'center', gap: '1.5rem',
          border: '2px solid var(--primary)'
        }}>
          <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>נבחרו {selectedItems.size} {activeTab === 'photo' ? 'תמונות' : 'סרטונים'}</span>
          <button 
            onClick={handleBulkDownload}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          >
            <span>⬇️ הורד בחירה</span>
          </button>
        </div>
      )}
    </div>
  );
}

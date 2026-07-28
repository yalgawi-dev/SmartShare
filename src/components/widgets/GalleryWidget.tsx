'use client';

import { useState, useRef } from 'react';
import { useSpaces } from '../../app/context/SpacesContext';

export default function GalleryWidget({ space, onRemove }: { space: any, onRemove?: () => void }) {
  const { addMediaItem } = useSpaces();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const photos = (space.mediaItems || []).filter((m: any) => m.type === 'photo');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create a temporary object URL for the image
      const url = URL.createObjectURL(file);
      
      // In a real app we would upload the file to a server here.
      // For this demo, we use the local object URL.
      addMediaItem(space.id, {
        type: 'photo',
        url,
        authorName: 'אורח/ת', // Could prompt for name, but keep it simple for now
      });
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="card glass-panel" style={{ padding: '2rem', marginBottom: '2rem', background: 'var(--bg-card)', position: 'relative' }}>
      
      {/* Hidden file input for camera/gallery */}
      <input 
        type="file" 
        accept="image/*" 
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
              צלמו והעלו תמונות בלייב מהאירוע!
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={handleCameraClick}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span>+ צלם תמונה</span>
          </button>
          {onRemove && (
            <button onClick={onRemove} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.25rem' }} title="הסר פיצ'ר מהקיר">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Photos Masonry/Grid */}
      {photos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📷</div>
          <p>הגלריה ריקה.</p>
          <p style={{ fontSize: '0.9rem' }}>תהיו הראשונים לצלם משהו מעניין!</p>
          <button 
            onClick={handleCameraClick}
            style={{ marginTop: '1.5rem', background: 'var(--text-primary)', color: 'var(--bg-primary)', border: 'none', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer' }}
          >
            פתח מצלמה
          </button>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
          gap: '1rem',
          alignItems: 'start'
        }}>
          {photos.map((photo: any) => (
            <div key={photo.id} style={{ 
              borderRadius: 'var(--radius-md)', 
              overflow: 'hidden', 
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              position: 'relative',
              aspectRatio: '1', // Makes it a square grid
              background: '#f0f0f0'
            }}>
              <img 
                src={photo.url} 
                alt="Live event photo" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
              <div style={{ 
                position: 'absolute', 
                bottom: 0, 
                left: 0, 
                right: 0, 
                padding: '1rem 0.5rem 0.5rem', 
                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                color: 'white',
                fontSize: '0.8rem',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>{photo.authorName}</span>
                <span>{photo.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

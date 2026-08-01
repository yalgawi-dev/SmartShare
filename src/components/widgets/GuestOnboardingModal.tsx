'use client';

import { useState, useRef } from 'react';
import { useGuest } from '../../app/context/GuestContext';
import { compressImage } from '../../utils/imageOptimizer';
import { uploadImageToStorage } from '@/lib/firebase';

export default function GuestOnboardingModal() {
  const { profile, saveProfile } = useGuest();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // If they already have a profile, don't show the onboarding
  if (profile) return null;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file, 400, 400, 0.8);
      setAvatarPreview(compressed);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const status = formData.get('status') as any;
    
    setIsUploading(true);
    let finalUrl = avatarPreview;
    if (avatarPreview && avatarPreview.startsWith('data:image')) {
      try {
        finalUrl = await uploadImageToStorage(avatarPreview, `guests/avatars/${Date.now()}.jpg`);
      } catch (err) {
        console.error("Upload error", err);
      }
    }

    saveProfile({
      name,
      avatarUrl: finalUrl || undefined,
      status
    });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem'
    }}>
      <div className="card glass-panel" style={{
        background: 'white',
        padding: '2rem',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '450px',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>ברוכים הבאים לאירוע! 🥳</h2>
          <p style={{ color: 'var(--text-secondary)' }}>כדי שתוכלו להגיב, להעלות תמונות ולעשות לייקים, ניצור לכם כרטיס אורח מהיר.</p>
        </div>

        <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 'bold', display: 'flex', gap: '0.5rem' }}>
            <span>💡</span>
            <span>אל דאגה, כל התמונות שתצלמו דרך האפליקציה יישמרו אוטומטית גם בגלריה של הטלפון שלכם!</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Avatar Upload */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <div 
              onClick={() => fileInputRef.current?.click()}
              style={{ 
                width: '100px', height: '100px', borderRadius: '50%', 
                background: 'var(--bg-card)', border: '2px dashed var(--border-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                cursor: 'pointer', overflow: 'hidden',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
              }}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ fontSize: '2rem', color: 'var(--text-secondary)' }}>📷</div>
              )}
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>העלו תמונת סלפי</span>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleAvatarChange} style={{ display: 'none' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>איך קוראים לכם?</label>
            <input required name="name" placeholder="השם שלכם..." style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', fontSize: '1rem' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>סטטוס זוגי (אופציונלי)</label>
            <select name="status" style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'white' }}>
              <option value="hidden">לא מעוניין/ת להציג</option>
              <option value="single">רווק/ה</option>
              <option value="relationship">בזוגיות</option>
              <option value="married">נשוי/ה</option>
              <option value="complicated">מסובך</option>
            </select>
          </div>

          <button type="submit" style={{ 
            background: 'var(--primary)', color: 'white', border: 'none', 
            padding: '1rem', borderRadius: 'var(--radius-md)', fontWeight: 'bold', 
            fontSize: '1.1rem', cursor: 'pointer', marginTop: '0.5rem',
            boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)'
          }}>
            כניסה לאירוע! 🚀
          </button>
        </form>
      </div>
    </div>
  );
}

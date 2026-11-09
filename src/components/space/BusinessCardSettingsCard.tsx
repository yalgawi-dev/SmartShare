'use client';

import React, { useState, useEffect } from 'react';
import { Space, useSpaces, BusinessCardSettings } from '@/app/context/SpacesContext';
import { uploadBlobToStorage } from '@/lib/firebase';

interface BusinessCardSettingsCardProps {
  space: Space;
}

export function BusinessCardSettingsCard({ space }: BusinessCardSettingsCardProps) {
  const { updateSpaceSettings, updateSpaceLogo } = useSpaces();

  const [businessName, setBusinessName] = useState(space.settings?.businessCard?.businessName || space.title || '');
  const [slogan, setSlogan] = useState(space.settings?.businessCard?.slogan || space.description || '');
  const [phone, setPhone] = useState(space.settings?.businessCard?.phone || '');
  const [whatsapp, setWhatsapp] = useState(space.settings?.businessCard?.whatsapp || '');
  const [websiteUrl, setWebsiteUrl] = useState(space.settings?.businessCard?.websiteUrl || '');
  const [portfolioUrl, setPortfolioUrl] = useState(space.settings?.businessCard?.portfolioUrl || '');
  const [portfolioDescription, setPortfolioDescription] = useState(space.settings?.businessCard?.portfolioDescription || '');
  const [logoUrl, setLogoUrl] = useState(space.settings?.businessCard?.logoUrl || space.logoUrl || '');

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  useEffect(() => {
    if (space?.settings?.businessCard) {
      const bc = space.settings.businessCard;
      setBusinessName(bc.businessName ?? (space.title || ''));
      setSlogan(bc.slogan ?? (space.description || ''));
      setPhone(bc.phone ?? '');
      setWhatsapp(bc.whatsapp ?? '');
      setWebsiteUrl(bc.websiteUrl ?? '');
      setPortfolioUrl(bc.portfolioUrl ?? '');
      setPortfolioDescription(bc.portfolioDescription ?? '');
      setLogoUrl(bc.logoUrl || space.logoUrl || '');
    }
  }, [space]);

  const handleCopyPhoneToWhatsapp = () => {
    if (phone) {
      setWhatsapp(phone.replace(/\D/g, ''));
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    try {
      const path = `spaces/${space.id}/branding/logo_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const downloadUrl = await uploadBlobToStorage(file, path);
      setLogoUrl(downloadUrl);
      updateSpaceLogo(space.id, downloadUrl);
    } catch (err) {
      console.error('Failed to upload logo:', err);
      alert('שגיאה בהעלאת הלוגו, אנא נסה שוב.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedCard: BusinessCardSettings = {
        businessName: businessName.trim(),
        slogan: slogan.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        websiteUrl: websiteUrl.trim(),
        portfolioUrl: portfolioUrl.trim(),
        portfolioDescription: portfolioDescription.trim(),
        logoUrl: logoUrl.trim()
      };

      await updateSpaceSettings(space.id, {
        businessCard: updatedCard
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving business card settings:', err);
      alert('שגיאה בשמירת הגדרות כרטיס הביקור.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Title Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            כרטיס ביקור ומיתוג דף שיתוף
          </span>
          <span style={{ fontSize: '0.65rem', background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: '6px', fontWeight: 800 }}>
            v3.5.43
          </span>
        </div>
        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(0,0,0,0.1), transparent)' }}></div>
      </div>

      <section 
        className="card glass-panel" 
        style={{ 
          padding: '1.25rem', 
          background: 'var(--bg-card)', 
          borderRadius: 'var(--radius-lg)', 
          boxShadow: '0 10px 40px rgba(0,0,0,0.06)', 
          border: '1px solid rgba(0,0,0,0.05)', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.25rem' 
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>📇</span> כרטיס ביקור דיגיטלי ותיק עבודות
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              הפרטים שתגדיר כאן יופיעו בראש דפי השיתוף הציבוריים ובהודעות הוואטסאפ, וישמשו ככרטיס ביקור יוקרתי לשיווק העסק שלך.
            </p>
          </div>
        </div>

        {/* Form Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          
          {/* Business Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              שם העסק / נותן השירות
            </label>
            <input
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="לדוגמה: סטודיו לעיצוב ואדריכלות"
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-primary, #ffffff)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Slogan */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              סלוגן / תיאור מה העסק עושה
            </label>
            <input
              type="text"
              value={slogan}
              onChange={e => setSlogan(e.target.value)}
              placeholder="לדוגמה: ניהול פרויקטים, תכנון ופיקוח הנדסי"
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-primary, #ffffff)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Phone */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              📞 טלפון ישיר להתקשרות
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="לדוגמה: 050-1234567"
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-primary, #ffffff)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </div>

          {/* WhatsApp */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                💬 מספר וואטסאפ לשיחה מהירה
              </label>
              {phone && (
                <button
                  type="button"
                  onClick={handleCopyPhoneToWhatsapp}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary, #6366f1)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  העתק מטלפון ↗
                </button>
              )}
            </div>
            <input
              type="tel"
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              placeholder="לדוגמה: 0501234567 (או 972501234567)"
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-primary, #ffffff)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Website URL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              🌐 כתובת אתר אינטרנט
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={e => setWebsiteUrl(e.target.value)}
              placeholder="https://mybusiness.com"
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-primary, #ffffff)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Portfolio URL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              🎨 לינק לתיק עבודות / גלריה חיצונית
            </label>
            <input
              type="url"
              value={portfolioUrl}
              onChange={e => setPortfolioUrl(e.target.value)}
              placeholder="לדוגמה: Behance, Drive, Instagram, אתר עבודות..."
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-primary, #ffffff)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Portfolio Description & Logo row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              תיאור תיק העבודות (יופיע לצד הכפתור בדף השיתוף)
            </label>
            <input
              type="text"
              value={portfolioDescription}
              onChange={e => setPortfolioDescription(e.target.value)}
              placeholder="לדוגמה: צפו בקטלוג הפרויקטים והעבודות הנבחרות שלנו"
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-primary, #ffffff)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Logo Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.02)', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, border: '1px solid #cbd5e1' }}>
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '1.5rem' }}>🏢</span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                לוגו העסק
              </span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: isUploadingLogo ? 'wait' : 'pointer', fontSize: '0.75rem', color: 'var(--primary, #4f46e5)', fontWeight: 800, marginTop: '2px' }}>
                <span>{isUploadingLogo ? 'מעלה לוגו...' : '📸 החלף לוגו עסקי'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={isUploadingLogo}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Live Preview Box */}
        <div style={{ marginTop: '0.5rem', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderRadius: '16px', padding: '1.25rem', color: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              תצוגה מקדימה: איך הלקוח יראה את הכרטיס בדף השיתוף
            </span>
            <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.1)', color: '#38bdf8', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
              Live Card
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#ffffff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '1.75rem' }}>🏢</span>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {businessName || 'שם העסק שלך'}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {slogan || 'סלוגן ותיאור השירות'}
              </p>
            </div>
          </div>

          {/* Action Buttons Preview */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {phone && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#3b82f6', color: '#ffffff', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>
                📞 התקשר
              </span>
            )}
            {whatsapp && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#22c55e', color: '#ffffff', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>
                💬 וואטסאפ
              </span>
            )}
            {websiteUrl && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.15)', color: '#ffffff', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>
                🌐 אתר
              </span>
            )}
            {portfolioUrl && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', color: '#ffffff', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800 }}>
                🎨 תיק עבודות
              </span>
            )}
            {!phone && !whatsapp && !websiteUrl && !portfolioUrl && (
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                הזן טלפון, וואטסאפ או קישורים למעלה כדי לראות כפתורי פעולה.
              </span>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
          {savedSuccess && (
            <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 800 }}>
              ✓ כרטיס הביקור נשמר בהצלחה!
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              background: 'var(--primary, #4f46e5)',
              color: '#ffffff',
              border: 'none',
              padding: '0.65rem 1.75rem',
              borderRadius: '12px',
              fontSize: '0.9rem',
              fontWeight: 800,
              cursor: isSaving ? 'wait' : 'pointer',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <span>💾</span> {isSaving ? 'שומר...' : 'שמור כרטיס ביקור ומיתוג'}
          </button>
        </div>
      </section>
    </div>
  );
}
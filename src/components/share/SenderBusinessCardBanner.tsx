'use client';

import React from 'react';
import { PublicSharedData } from '@/utils/fileShareUtils';

interface SenderBusinessCardBannerProps {
  shareData: PublicSharedData;
}

export function SenderBusinessCardBanner({ shareData }: SenderBusinessCardBannerProps) {
  const card = shareData.businessCard;
  if (!card) return null;

  const businessName = card.businessName || shareData.spaceTitle;
  const slogan = card.slogan;
  const phone = card.phone;
  const whatsapp = card.whatsapp || phone;
  const websiteUrl = card.websiteUrl;
  const portfolioUrl = card.portfolioUrl;
  const portfolioDescription = card.portfolioDescription;
  const logoUrl = card.logoUrl || shareData.spaceLogoUrl;

  const cleanWhatsappNumber = whatsapp ? whatsapp.replace(/\D/g, '') : '';
  const formattedWhatsappNumber = cleanWhatsappNumber.startsWith('0')
    ? `972${cleanWhatsappNumber.slice(1)}`
    : cleanWhatsappNumber;

  const hasAnyContact = Boolean(phone || whatsapp || websiteUrl || portfolioUrl);

  return (
    <div style={{
      margin: '0 0 1.25rem 0',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
      borderRadius: '20px',
      padding: '1.25rem 1.5rem',
      color: '#ffffff',
      boxShadow: '0 12px 30px -8px rgba(15, 23, 42, 0.35)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative background glow */}
      <div style={{
        position: 'absolute',
        top: '-40px',
        left: '-40px',
        width: '140px',
        height: '140px',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#a5b4fc', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            📇 כרטיס ביקור ופרופיל עסקי
          </span>
          <span style={{ fontSize: '0.62rem', background: 'rgba(255,255,255,0.15)', color: '#38bdf8', padding: '1px 6px', borderRadius: '5px', fontWeight: 800 }}>
            v3.5.44
          </span>
        </div>

        <span style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>
          נשלח באמצעות SmartShare
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        {/* Business Logo / Avatar */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: '#ffffff',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 6px 16px rgba(0, 0, 0, 0.25)',
          border: '2px solid rgba(255, 255, 255, 0.2)'
        }}>
          {logoUrl ? (
            <img src={logoUrl} alt={businessName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: '2rem' }}>🏢</span>
          )}
        </div>

        {/* Business Info */}
        <div style={{ flex: 1, minWidth: '220px' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
            {businessName}
          </h2>
          {slogan && (
            <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.35 }}>
              {slogan}
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons: Phone, WhatsApp, Website, Portfolio */}
      {hasAnyContact && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.6rem',
          marginTop: '1.1rem',
          paddingTop: '0.85rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.12)'
        }}>
          {phone && (
            <a
              href={`tel:${phone}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: '#2563eb',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '0.5rem 0.95rem',
                borderRadius: '12px',
                fontSize: '0.82rem',
                fontWeight: 800,
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                transition: 'transform 0.1s ease'
              }}
            >
              <span>📞</span> התקשר {phone}
            </a>
          )}

          {whatsapp && (
            <a
              href={`https://wa.me/${formattedWhatsappNumber}?text=${encodeURIComponent(`שלום ${businessName}, ראיתי את המסמכים ששיתפת איתי ב-SmartShare.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: '#16a34a',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '0.5rem 0.95rem',
                borderRadius: '12px',
                fontSize: '0.82rem',
                fontWeight: 800,
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.35)',
                transition: 'transform 0.1s ease'
              }}
            >
              <span>💬</span> שלח וואטסאפ
            </a>
          )}

          {websiteUrl && (
            <a
              href={websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(255, 255, 255, 0.14)',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '0.5rem 0.95rem',
                borderRadius: '12px',
                fontSize: '0.82rem',
                fontWeight: 800,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)'
              }}
            >
              <span>🌐</span> אתר אינטרנט ↗
            </a>
          )}

          {portfolioUrl && (
            <a
              href={portfolioUrl.startsWith('http') ? portfolioUrl : `https://${portfolioUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '0.5rem 1.1rem',
                borderRadius: '12px',
                fontSize: '0.82rem',
                fontWeight: 900,
                boxShadow: '0 4px 15px rgba(236, 72, 153, 0.4)',
                letterSpacing: '0.2px'
              }}
            >
              <span>🎨</span> צפה בתיק עבודות ↗
            </a>
          )}
        </div>
      )}

      {/* Portfolio description footnote if present */}
      {portfolioDescription && portfolioUrl && (
        <p style={{ margin: '0.6rem 0 0 0', fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>
          💡 {portfolioDescription}
        </p>
      )}
    </div>
  );
}
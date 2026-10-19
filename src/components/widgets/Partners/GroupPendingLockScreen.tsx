'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../app/context/AuthContext';
import { useSpaces } from '../../../app/context/SpacesContext';
import { playSuccessChime } from '../../../utils/soundEffects';

interface Props {
  space: any;
  inviterName?: string;
}

export default function GroupPendingLockScreen({ space, inviterName }: Props) {
  const { user } = useAuth();
  const [checking, setChecking] = useState(false);
  const [wasApproved, setWasApproved] = useState(false);

  const displayInviter = inviterName || space?.createdBy || space?.creatorName || 'מנהל המרחב';

  // Check if member got approved in real-time
  const isApproved = Boolean(
    user?.id && space?.members?.some((m: any) => m.userId === user.id && m.status === 'active' && m.isActive !== false)
  );

  useEffect(() => {
    if (isApproved && !wasApproved) {
      setWasApproved(true);
      playSuccessChime();
    }
  }, [isApproved, wasApproved]);

  const handleRefresh = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }, 800);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      padding: '1.5rem',
      direction: 'rtl',
      fontFamily: 'inherit'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '28px',
        padding: '2.5rem 2rem',
        maxWidth: '480px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow Accent */}
        <div style={{
          position: 'absolute',
          top: '-80px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        {/* Lock Animation Icon */}
        <div style={{
          width: '90px',
          height: '90px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          border: '2px solid #bfdbfe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem auto',
          boxShadow: '0 10px 25px rgba(59, 130, 246, 0.2)'
        }}>
          <span style={{ fontSize: '3rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}>🔒</span>
        </div>

        {/* Space Title Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          background: 'linear-gradient(90deg, #eef2ff, #f5f3ff)',
          color: '#4f46e5',
          padding: '0.35rem 0.9rem',
          borderRadius: '20px',
          fontSize: '0.85rem',
          fontWeight: 800,
          marginBottom: '1rem',
          border: '1px solid #c7d2fe'
        }}>
          <span>{space.icon || '📁'}</span>
          <span>{space.title}</span>
          <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>v6.8.51</span>
        </div>

        <h2 style={{
          margin: '0 0 1rem 0',
          fontSize: '1.6rem',
          fontWeight: 900,
          color: '#0f172a',
          letterSpacing: '-0.5px'
        }}>
          בקשת ההצטרפות התקבלה!
        </h2>

        {/* Highlighted Approval Notice as requested by User */}
        <div style={{
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          border: '1.5px solid #fde68a',
          borderRadius: '18px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.08)'
        }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#92400e', marginBottom: '0.4rem' }}>
            המרחב ממתין לאישור
          </div>
          <p style={{
            margin: 0,
            fontSize: '1rem',
            lineHeight: 1.6,
            color: '#78350f',
            fontWeight: 600
          }}>
            הגישה למרחב תתקבל ברגע ש-
            <span style={{
              background: '#fbbf24',
              color: '#451a03',
              padding: '0.15rem 0.6rem',
              borderRadius: '8px',
              fontWeight: 900,
              margin: '0 0.25rem',
              display: 'inline-block'
            }}>
              {displayInviter}
            </span>
            יאשר את הצטרפותכם!
          </p>
        </div>

        <p style={{
          margin: '0 0 1.75rem 0',
          fontSize: '0.88rem',
          color: '#64748b',
          lineHeight: 1.5
        }}>
          נשלחה הודעה למנהל המרחב. ברגע שהבקשה תאושר, המרחב ייפתח עבורכם מיד ותקבלו התראת Push עם צליל.
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            onClick={handleRefresh}
            disabled={checking}
            style={{
              width: '100%',
              padding: '0.9rem',
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '14px',
              fontWeight: 800,
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 10px 20px -5px rgba(79, 70, 229, 0.4)',
              transition: 'transform 0.15s ease'
            }}
          >
            <span>🔄</span>
            <span>{checking ? 'בודק סטטוס...' : 'בדוק אם אושרתי'}</span>
          </button>

          <Link
            href="/"
            style={{
              display: 'block',
              textDecoration: 'none',
              padding: '0.8rem',
              background: '#f1f5f9',
              color: '#475569',
              borderRadius: '14px',
              fontWeight: 700,
              fontSize: '0.95rem',
              transition: 'background 0.2s'
            }}
          >
            חזרה ללוח המרחבים הראשי
          </Link>
        </div>
      </div>
    </div>
  );
}

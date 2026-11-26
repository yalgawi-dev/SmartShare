'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useSpaces } from '@/app/context/SpacesContext';
import { SmartCalendarWidget } from '@/components/widgets/Calendar/SmartCalendarWidget';
import { APP_VERSION } from '@/constants/version';

/**
 * Standalone Master Calendar Page (`/calendar`)
 * Works 100% independently — even if the user has ZERO spaces!
 * Automatically merges the user's Private Personal Calendar (`🔒 אישי שלי`)
 * with ALL spaces where `smart_calendar` is enabled (including full Parenting/Custody coloring & swaps).
 */
export default function StandaloneCalendarPage() {
  const { spaces } = useSpaces() as any;

  const allCalendarSpaces = useMemo(
    () =>
      (Array.isArray(spaces) ? spaces : []).filter(
        (sp: any) =>
          sp &&
          !sp.deletedAt &&
          Array.isArray(sp.features) &&
          sp.features.includes('smart_calendar')
      ),
    [spaces]
  );

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100dvh',
        background: '#f8fafc',
        padding: '0.65rem 0.65rem 6rem',
        maxWidth: '640px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.55rem',
      }}
    >
      {/* Clean Compact Top Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '0.35rem 0.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span style={{ fontSize: '1.35rem' }}>📅</span>
          <h1 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 900, color: '#0f172a' }}>
            היומן שלי
          </h1>
          <span
            style={{
              fontSize: '0.66rem',
              background: '#eef2ff',
              color: '#4338ca',
              border: '1px solid #c7d2fe',
              borderRadius: '6px',
              padding: '1px 6px',
              fontWeight: 800,
            }}
          >
            {APP_VERSION}
          </span>
        </div>

        <Link
          href="/"
          style={{
            background: 'linear-gradient(135deg, #4f46e5, #2563eb)',
            color: '#ffffff',
            border: '1.5px solid #4338ca',
            padding: '0.32rem 0.78rem',
            borderRadius: '10px',
            fontWeight: 800,
            fontSize: '0.78rem',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.32rem',
            boxShadow: '0 3px 10px rgba(79,70,229,0.28)',
          }}
        >
          <span>🏠</span>
          <span>דף ראשי</span>
        </Link>
      </header>

      {/* Single Source of Truth Calendar Engine (Zero Duplication!) */}
      <SmartCalendarWidget allCalendarSpaces={allCalendarSpaces} />

      {/* Standalone Calendar Floating Bottom Bar */}
      <nav
        style={{
          position: 'fixed',
          bottom: '1.25rem',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '96%',
          maxWidth: '420px',
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: '24px',
          padding: '0.4rem 0.6rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)',
          zIndex: 99999,
        }}
      >
        <div style={{ display: 'flex', flex: 1, justifyContent: 'space-evenly', alignItems: 'center' }}>
          <Link
            href="/"
            style={{
              textDecoration: 'none',
              padding: '0.4rem 0.25rem',
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.15rem',
              color: '#475569',
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>🏠</span>
            <span style={{ fontSize: '0.62rem', fontWeight: 800 }}>ראשי</span>
          </Link>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('smartshare:calendar_open_layers'))}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0.4rem 0.25rem',
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.15rem',
              cursor: 'pointer',
              color: '#4f46e5',
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>📚</span>
            <span style={{ fontSize: '0.62rem', fontWeight: 800 }}>שכבות</span>
          </button>
        </div>

        {/* Center Hero Add FAB */}
        <div style={{ position: 'relative', marginTop: '-2.35rem', display: 'flex', justifyContent: 'center', zIndex: 10 }}>
          <div
            style={{
              position: 'absolute',
              top: '0.1rem',
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: '#ffffff',
              borderTop: '1px solid rgba(0,0,0,0.08)',
              boxShadow: '0 -10px 20px rgba(0,0,0,0.04)',
              zIndex: 1,
            }}
          />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('smartshare:calendar_quick_add'))}
            style={{
              position: 'relative',
              zIndex: 2,
              background: 'linear-gradient(135deg, #4f46e5, #2563eb)',
              border: 'none',
              borderRadius: '50%',
              width: '58px',
              height: '58px',
              color: '#ffffff',
              fontSize: '1.85rem',
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(79,70,229,0.42)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="הוסף משימה, פגישה או הערה"
          >
            +
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, justifyContent: 'space-evenly', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('smartshare:calendar_toggle_swap'))}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0.4rem 0.25rem',
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.15rem',
              cursor: 'pointer',
              color: '#0284c7',
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>🔄</span>
            <span style={{ fontSize: '0.62rem', fontWeight: 800 }}>החלף יום</span>
          </button>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('smartshare:calendar_open_settings'))}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0.4rem 0.25rem',
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.15rem',
              cursor: 'pointer',
              color: '#334155',
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>⚙️</span>
            <span style={{ fontSize: '0.62rem', fontWeight: 800 }}>הגדרות</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

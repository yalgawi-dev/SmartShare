'use client';

import React from 'react';
import Link from 'next/link';

export type ReportType = 'date_range' | 'settlement' | 'audit' | 'analytics';

interface ReportsFloatingDockProps {
  spaceId: string;
  activeReport: ReportType;
  onSwitchReport: (report: ReportType) => void;
  onOpenFilter?: () => void;
  onExportCSV?: () => void;
  onOpenZip?: () => void;
  zipCount?: number;
}

export function ReportsFloatingDock({
  spaceId,
  activeReport,
  onSwitchReport,
  onOpenFilter,
  onExportCSV,
  onOpenZip,
  zipCount = 0
}: ReportsFloatingDockProps) {

  const handleFilterClick = () => {
    if (onOpenFilter) {
      onOpenFilter();
    } else {
      window.dispatchEvent(new CustomEvent('smartshare:reports_open_filter'));
    }
  };

  const handleExportCSVClick = () => {
    if (onExportCSV) {
      onExportCSV();
    } else {
      window.dispatchEvent(new CustomEvent('smartshare:reports_export_csv'));
    }
  };

  const handleZipClick = () => {
    if (onOpenZip) {
      onOpenZip();
    } else {
      window.dispatchEvent(new CustomEvent('smartshare:reports_open_zip'));
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '98%',
        maxWidth: '460px',
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '24px',
        padding: '0.4rem 0.6rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)',
        zIndex: 99999,
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        direction: 'rtl',
        boxSizing: 'border-box'
      }}
    >
      {/* 1. RIGHT SIDE: BACK BUTTON & REPORT TABS */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', flex: 1, justifyContent: 'space-evenly' }}>
        
        {/* BACK TO SPACE */}
        <Link
          href={`/space/${spaceId}`}
          style={{
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid #bfdbfe',
            padding: '0.45rem 0.25rem',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            color: '#1d4ed8',
            minWidth: '40px',
            transition: 'all 0.2s',
            cursor: 'pointer'
          }}
          title="חזרה למרחב"
        >
          <span style={{ fontSize: '1.15rem', lineHeight: '1' }}>↩️</span>
          <span style={{ fontSize: '0.62rem', fontWeight: '800' }}>חזרה</span>
        </Link>

        {/* TAB 1: EXPENSES & DATES */}
        <button
          type="button"
          onClick={() => onSwitchReport('date_range')}
          style={{
            background: activeReport === 'date_range' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            border: 'none',
            padding: '0.45rem 0.2rem',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.15rem',
            cursor: 'pointer',
            color: activeReport === 'date_range' ? '#2563eb' : '#64748b',
            minWidth: '44px',
            transition: 'all 0.2s',
            boxShadow: activeReport === 'date_range' ? '0 2px 8px rgba(59,130,246,0.1)' : 'none'
          }}
        >
          <span style={{ fontSize: '1.15rem', lineHeight: '1' }}>📅</span>
          <span style={{ fontSize: '0.62rem', fontWeight: activeReport === 'date_range' ? '800' : '600' }}>פירוט</span>
        </button>

        {/* TAB 2: PARTNER SETTLEMENT */}
        <button
          type="button"
          onClick={() => onSwitchReport('settlement')}
          style={{
            background: activeReport === 'settlement' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            border: 'none',
            padding: '0.45rem 0.2rem',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.15rem',
            cursor: 'pointer',
            color: activeReport === 'settlement' ? '#2563eb' : '#64748b',
            minWidth: '48px',
            transition: 'all 0.2s',
            boxShadow: activeReport === 'settlement' ? '0 2px 8px rgba(59,130,246,0.1)' : 'none'
          }}
        >
          <span style={{ fontSize: '1.15rem', lineHeight: '1' }}>🤝</span>
          <span style={{ fontSize: '0.62rem', fontWeight: activeReport === 'settlement' ? '800' : '600' }}>התחשבנות</span>
        </button>

        {/* TAB: AUDIT LOG (שינויים ופעולות) */}
        <button
          type="button"
          onClick={() => onSwitchReport('audit')}
          style={{
            background: activeReport === 'audit' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            border: 'none',
            padding: '0.45rem 0.2rem',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.15rem',
            cursor: 'pointer',
            color: activeReport === 'audit' ? '#2563eb' : '#64748b',
            minWidth: '40px',
            transition: 'all 0.2s',
            boxShadow: activeReport === 'audit' ? '0 2px 8px rgba(59,130,246,0.1)' : 'none'
          }}
          title="יומן שינויים ופעולות"
        >
          <span style={{ fontSize: '1.15rem', lineHeight: '1' }}>📜</span>
          <span style={{ fontSize: '0.62rem', fontWeight: activeReport === 'audit' ? '800' : '600' }}>שינויים</span>
        </button>

        {/* TAB 3: ANALYTICS & CHARTS */}
        <button
          type="button"
          onClick={() => onSwitchReport('analytics')}
          style={{
            background: activeReport === 'analytics' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            border: 'none',
            padding: '0.45rem 0.2rem',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.15rem',
            cursor: 'pointer',
            color: activeReport === 'analytics' ? '#2563eb' : '#64748b',
            minWidth: '44px',
            transition: 'all 0.2s',
            boxShadow: activeReport === 'analytics' ? '0 2px 8px rgba(59,130,246,0.1)' : 'none'
          }}
        >
          <span style={{ fontSize: '1.15rem', lineHeight: '1' }}>📈</span>
          <span style={{ fontSize: '0.62rem', fontWeight: activeReport === 'analytics' ? '800' : '600' }}>גרפים</span>
        </button>

      </div>

      {/* 2. SUBTLE VERTICAL DIVIDER */}
      <div style={{ width: '1px', height: '26px', background: 'rgba(0,0,0,0.1)', margin: '0 0.3rem' }} />

      {/* 3. LEFT SIDE: REPORT ACTIONS */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
        
        {/* FILTER BUTTON */}
        <button
          type="button"
          onClick={handleFilterClick}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '0.45rem 0.25rem',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.15rem',
            cursor: 'pointer',
            color: '#475569',
            minWidth: '38px',
            transition: 'all 0.2s'
          }}
          title="פתח סינון נתונים"
        >
          <span style={{ fontSize: '1.15rem', lineHeight: '1' }}>🔍</span>
          <span style={{ fontSize: '0.62rem', fontWeight: '700' }}>סינון</span>
        </button>

        {/* EXPORT EXCEL */}
        <button
          type="button"
          onClick={handleExportCSVClick}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '0.45rem 0.25rem',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.15rem',
            cursor: 'pointer',
            color: '#059669',
            minWidth: '38px',
            transition: 'all 0.2s'
          }}
          title="ייצא נתונים לקובץ CSV"
        >
          <span style={{ fontSize: '1.15rem', lineHeight: '1' }}>📊</span>
          <span style={{ fontSize: '0.62rem', fontWeight: '700' }}>אקסל</span>
        </button>

        {/* EXPORT ZIP (Available across all tabs when files exist) */}
        {zipCount > 0 && (
          <button
            type="button"
            onClick={handleZipClick}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0.45rem 0.25rem',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.15rem',
              cursor: 'pointer',
              color: '#d97706',
              minWidth: '38px',
              transition: 'all 0.2s'
            }}
            title="ייצוא כל הצרופות בקובץ ZIP"
          >
            <span style={{ fontSize: '1.15rem', lineHeight: '1' }}>📦</span>
            <span style={{ fontSize: '0.62rem', fontWeight: '700' }}>ZIP ({zipCount})</span>
          </button>
        )}

      </div>
    </div>
  );
}

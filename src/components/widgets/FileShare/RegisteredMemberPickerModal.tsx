'use client';

import React, { useState, useMemo } from 'react';

export interface SelectableMember {
  id: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
  role?: string;
  info?: string;
}

interface RegisteredMemberPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMember: (member: SelectableMember) => void;
  members: SelectableMember[];
}

export function RegisteredMemberPickerModal({
  isOpen,
  onClose,
  onSelectMember,
  members
}: RegisteredMemberPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.trim().toLowerCase();
    return members.filter(m => 
      m.name.toLowerCase().includes(q) || 
      (m.phone && m.phone.includes(q)) ||
      (m.info && m.info.toLowerCase().includes(q))
    );
  }, [members, searchQuery]);

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100050,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        direction: 'rtl'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '380px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
          animation: 'fadeIn 0.15s ease-out'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>👥</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 900, color: '#0f172a' }}>
                בחר חבר רשום או שותף
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                לחיצה אחת תמלא את הפרטים מיד בחלון השיתוף
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#e2e8f0',
              border: 'none',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              fontWeight: 800,
              color: '#475569'
            }}
          >
            ✕
          </button>
        </div>

        {/* Search Input */}
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="🔍 חפש לפי שם או טלפון..."
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              boxSizing: 'border-box',
              outline: 'none',
              background: '#f8fafc'
            }}
          />
        </div>

        {/* Members List - Compact & Contained */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: '300px',
          padding: '0.5rem'
        }}>
          {filteredMembers.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              <span>🔍</span>
              <p style={{ margin: '0.5rem 0 0 0' }}>לא נמצאו חברים מתאימים</p>
            </div>
          ) : (
            filteredMembers.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onSelectMember(m);
                  onClose();
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'right',
                  transition: 'background 0.15s ease',
                  borderBottom: '1px solid #f8fafc'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Avatar */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#e0e7ff',
                  color: '#4338ca',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  flexShrink: 0,
                  overflow: 'hidden'
                }}>
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    m.name.charAt(0) || '👤'
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.name}
                    </span>
                    {m.role && (
                      <span style={{ fontSize: '0.65rem', background: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: '4px', fontWeight: 700, flexShrink: 0 }}>
                        {m.role}
                      </span>
                    )}
                  </div>
                  {m.phone && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span>📞</span>
                      <span>{m.phone}</span>
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                  ←
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.6rem 1rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            חזור לחלון הקודם
          </button>
        </div>
      </div>
    </div>
  );
}

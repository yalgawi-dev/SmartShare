'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  itemTitle?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  icon?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  itemTitle,
  confirmText = 'מחק לצמיתות',
  cancelText = 'ביטול',
  variant = 'danger',
  icon = '🗑️',
  onConfirm,
  onClose
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const getConfirmStyle = () => {
    if (variant === 'danger') {
      return {
        background: '#ef4444',
        color: '#ffffff',
        boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
      };
    }
    if (variant === 'warning') {
      return {
        background: '#f59e0b',
        color: '#ffffff',
        boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)'
      };
    }
    return {
      background: 'var(--primary, #3b82f6)',
      color: '#ffffff',
      boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
    };
  };

  return createPortal(
    <div 
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100005,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        padding: '1.25rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: '380px',
          borderRadius: '24px',
          padding: '1.75rem 1.5rem',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative',
          direction: 'rtl'
        }}
      >
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            fontSize: '1rem',
            transition: 'background 0.2s'
          }}
        >
          ✕
        </button>

        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: variant === 'danger' ? '#fee2e2' : '#fef3c7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          margin: '0 auto 1rem auto'
        }}>
          {icon}
        </div>

        <h3 style={{
          margin: '0 0 0.5rem 0',
          color: '#0f172a',
          fontSize: '1.3rem',
          fontWeight: '800'
        }}>
          {title}
        </h3>

        <p style={{
          margin: '0 0 1rem 0',
          color: '#475569',
          fontSize: '0.95rem',
          lineHeight: '1.5'
        }}>
          {message}
        </p>

        {itemTitle && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '0.6rem 0.8rem',
            marginBottom: '1.25rem',
            color: '#1e293b',
            fontWeight: '600',
            fontSize: '0.9rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            📄 {itemTitle}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '0.85rem',
              borderRadius: '14px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#475569',
              fontWeight: '700',
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            {cancelText}
          </button>

          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{
              flex: 1.2,
              padding: '0.85rem',
              borderRadius: '14px',
              border: 'none',
              fontWeight: '800',
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
              ...getConfirmStyle()
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
}

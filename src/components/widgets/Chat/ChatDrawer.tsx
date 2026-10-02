'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useChat } from '../../../app/context/ChatContext';
import { useSpaces } from '../../../app/context/SpacesContext';
import { useAuth } from '../../../app/context/AuthContext';
import ChatEngineUI from './ChatEngineUI';

interface ChatDrawerProps {
  spaceId: string;
}

export default function ChatDrawer({ spaceId }: ChatDrawerProps) {
  const { isOpen, activeTarget, closeChat } = useChat();
  const { spaces } = useSpaces() as any;
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen || !activeTarget || typeof document === 'undefined') return null;

  const space = spaces?.find((s: any) => s.id === spaceId);
  if (!space) return null;

  // Determine chat titles
  let title = 'צ\'אט';
  let isGroup = false;

  if (activeTarget === 'group') {
    title = 'צ\'אט קבוצתי';
    isGroup = true;
  } else {
    const member = space.members?.find((m: any) => m.userId === activeTarget);
    if (member) {
      title = `שיחה עם ${member.name}`;
    } else if (activeTarget === space.creatorId || activeTarget === space.createdBy) {
      title = `שיחה עם ${space.createdBy || 'מנהל המרחב'}`;
    }
  }

  // Animation states
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = 'hidden';
    } else {
      setIsVisible(false);
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      closeChat();
    }, 300); // Wait for transition
  };

  return createPortal(
    <>
      <div 
        onClick={handleClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 999998,
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.3s ease',
          pointerEvents: isVisible ? 'auto' : 'none'
        }}
      />
      
      {/* Side Drawer (slides from Right/Start in RTL) */}
      <div style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        right: 0,
        width: '100%',
        maxWidth: '500px', // On desktop it will be 500px right drawer
        background: '#e5ded8', // WhatsApp-like background
        zIndex: 999999,
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        direction: 'rtl'
      }}>
        {/* Header */}
        <div style={{ background: 'var(--primary)', color: 'white', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 10 }}>
          <button onClick={handleClose} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', padding: '0 0.5rem' }}>
            →
          </button>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>{title}</h2>
            {isGroup && (
              <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '0.2rem' }}>
                {space.members?.length || 0} משתתפים
              </div>
            )}
          </div>
        </div>

        {/* Chat Component */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ChatEngineUI 
            space={space} 
            conversationId={activeTarget} 
            isGroup={isGroup} 
            viewMode={activeTarget === space.creatorId ? 'partner' : 'creator'}
            member={space.members?.find((m: any) => m.userId === activeTarget)}
          />
        </div>
      </div>
    </>,
    document.body
  );
}

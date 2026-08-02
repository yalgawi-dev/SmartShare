'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';
import MessageEditor from '../shared/MessageEditor';
import StickerToolbox from '../shared/StickerToolbox';
import { renderSticker } from '../../utils/stickers';

export default function AlbumWidget({ space, isGuestMode, onRemove }: { space: any, isGuestMode?: boolean, onRemove?: () => void }) {
  const { addMediaItem, removeMediaItem, updateMediaItem } = useSpaces();
  const { user } = useAuth();
  
  const [isAddingMsg, setIsAddingMsg] = useState(false);
  const [isStickerToolboxOpen, setIsStickerToolboxOpen] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);

  const spaceMember = space.members?.find((m: any) => m.userId === user?.id);
  const useNicknameGlobally = user?.hideRealName || false;
  const useNickname = spaceMember?.useNickname !== undefined ? spaceMember.useNickname : useNicknameGlobally;
  const displayName = useNickname && user?.nickname ? user.nickname : (user?.realName || user?.nickname || 'אורח/ת');

  const messages = useMemo(() => {
    return (space.mediaItems || [])
      .filter((m: any) => m.type === 'message')
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [space.mediaItems]);

  const openEditMessage = (msg: any) => {
    setEditingMsgId(msg.id);
    setIsAddingMsg(true);
  };
  
  const handleAddSticker = (stickerId: string) => {
    addMediaItem(space.id, {
      type: 'message',
      authorName: displayName,
      authorId: user?.id,
      stickerId: stickerId,
      content: ''
    });
  };

  return (
    <div className="card glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📖 ספר אורחים
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => setIsAddingMsg(true)} 
            style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer' }}
          >
            ✏️ הוסף ברכה
          </button>
          <button 
            onClick={() => setIsStickerToolboxOpen(true)} 
            style={{ background: 'rgba(255, 193, 7, 0.2)', color: '#d97706', border: 'none', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer' }}
          >
            🎨 סטיקר
          </button>
          {onRemove && (
            <button 
              onClick={onRemove} 
              style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="הסר פיצ'ר מהקיר"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Masonry Grid for Messages */}
      {messages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✍️</div>
          <p>ספר האורחים ריק. תהיו הראשונים לכתוב משהו!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {messages.map((msg: any) => (
            <div key={msg.id} style={{ 
              background: msg.backgroundColor || 'var(--bg-main)', 
              color: msg.textColor || 'var(--text-primary)',
              fontFamily: msg.fontFamily || 'inherit',
              padding: '1.5rem', 
              borderRadius: '16px', 
              boxShadow: 'var(--shadow-sm)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              border: '1px solid var(--border-light)'
            }}>
              {/* Content */}
              {msg.stickerId ? (
                <div style={{ textAlign: 'center', fontSize: '4rem' }}>{renderSticker(msg.stickerId)}</div>
              ) : (
                <>
                  {msg.attachedPhotoUrl && (
                    <img src={msg.attachedPhotoUrl} alt="Attached" style={{ width: '100%', borderRadius: '8px', objectFit: 'cover', maxHeight: '200px' }} />
                  )}
                  <p style={{ margin: 0, fontSize: `${(msg.fontSize || 16) / 16}rem`, whiteSpace: 'pre-wrap', textAlign: msg.textAlign || 'right' }}>
                    {msg.content}
                  </p>
                </>
              )}
              
              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', opacity: 0.8 }}>{msg.authorName}</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{new Date(msg.timestamp).toLocaleDateString('he-IL')}</span>
              </div>

              {/* Edit Controls */}
              {(!isGuestMode || user?.id === msg.authorId) && (
                <div style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', display: 'flex', gap: '0.25rem', opacity: 0.5, transition: 'opacity 0.2s' }} className="msg-controls">
                  <button onClick={() => openEditMessage(msg)} style={{ background: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>✏️</button>
                  <button onClick={() => removeMediaItem(space.id, msg.id)} style={{ background: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', color: 'red', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>🗑</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isAddingMsg && (
        <MessageEditor 
          space={space} 
          existingMsgId={editingMsgId}
          onClose={() => { setIsAddingMsg(false); setEditingMsgId(null); }} 
        />
      )}

      {isStickerToolboxOpen && (
        <StickerToolbox 
          onClose={() => setIsStickerToolboxOpen(false)} 
          onSelectSticker={(sId) => { handleAddSticker(sId); setIsStickerToolboxOpen(false); }} 
        />
      )}

    </div>
  );
}

'use client';

import { useState } from 'react';
import { useSpaces } from '../../app/context/SpacesContext';

export default function GuestbookWidget({ space, onRemove }: { space: any, onRemove?: () => void }) {
  const { addMediaItem } = useSpaces();
  const [isAddingMsg, setIsAddingMsg] = useState(false);

  const messages = (space.mediaItems || []).filter((m: any) => m.type === 'message');

  const handleAddMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const authorName = formData.get('authorName') as string;
    const content = formData.get('content') as string;

    addMediaItem(space.id, {
      type: 'message',
      authorName,
      content,
    });
    setIsAddingMsg(false);
  };

  return (
    <div className="card glass-panel" style={{ padding: '2rem', marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(250, 245, 255, 0.9))', position: 'relative' }}>
      
      {/* Header and Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              💌 ספר אורחים (Guestbook)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              ברכות ואיחולים מהמשתתפים
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={() => setIsAddingMsg(true)}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span>+ כתוב ברכה</span>
          </button>
          {onRemove && (
            <button onClick={onRemove} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.25rem' }} title="הסר פיצ'ר מהקיר">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Add Message Modal */}
      {isAddingMsg && (
        <div style={{ background: 'rgba(255,255,255,0.8)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--border-light)' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>כתוב ברכה לאירוע:</h3>
          <form onSubmit={handleAddMessage} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input required name="authorName" placeholder="השם שלך (או ממי הברכה)" style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-light)' }} />
            <textarea required name="content" placeholder="איחולים לבביים..." rows={3} style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-light)', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button type="submit" style={{ flex: 1, background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>שלח ברכה ❤️</button>
              <button type="button" onClick={() => setIsAddingMsg(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-light)', padding: '0.75rem', borderRadius: '4px', cursor: 'pointer' }}>ביטול</button>
            </div>
          </form>
        </div>
      )}

      {/* Messages Grid */}
      {messages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📝</div>
          <p>עדיין אין ברכות.</p>
          <p style={{ fontSize: '0.9rem' }}>היה הראשון לאחל משהו מיוחד!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {messages.map((msg: any) => (
            <div key={msg.id} style={{ 
              background: 'white', 
              padding: '1.5rem', 
              borderRadius: 'var(--radius-lg)', 
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(0,0,0,0.05)',
              position: 'relative'
            }}>
              <p style={{ fontSize: '1.1rem', lineHeight: '1.5', margin: '0 0 1.5rem 0', fontStyle: 'italic', color: 'var(--text-primary)' }}>
                "{msg.content}"
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{msg.authorName}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{msg.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

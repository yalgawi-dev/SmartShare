import React, { useState } from 'react';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';
import { createPortal } from 'react-dom';

export default function CommentsModal({ spaceId, photo, onClose }: { spaceId: string, photo: any, onClose: () => void }) {
  const { addComment } = useSpaces();
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');

  if (!photo || typeof document === 'undefined') return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    addComment(spaceId, photo.id, {
      authorName: user?.nickname || user?.realName || 'אורח/ת',
      avatarUrl: user?.avatarUrl,
      text: commentText
    });
    setCommentText('');
  };

  return createPortal(
    <div 
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.85)', zIndex: 9999,
        display: 'flex', flexDirection: 'column',
        backdropFilter: 'blur(5px)'
      }}
    >
      <div style={{ padding: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '2rem', cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Media Side (Desktop) / Top (Mobile) */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', minHeight: 0, minWidth: 0 }}>
          {photo.type === 'video' ? (
            <video src={photo.url} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} controls autoPlay />
          ) : (
            <img src={photo.url} alt="Media" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
          )}
        </div>

        {/* Comments Side */}
        <div style={{ width: '350px', background: 'white', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-light)' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
             <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--border-light)', overflow: 'hidden' }}>
                {photo.avatarUrl ? <img src={photo.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%'}}>👤</span>}
             </div>
             <div>
               <h3 style={{ margin: 0, fontSize: '1rem' }}>{photo.authorName}</h3>
               <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{photo.timestamp}</span>
             </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(!photo.comments || photo.comments.length === 0) ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>
                <span style={{ fontSize: '2rem', opacity: 0.5 }}>💬</span>
                <p>תהיו הראשונים להגיב!</p>
              </div>
            ) : (
              photo.comments.map((comment: any) => (
                <div key={comment.id} style={{ display: 'flex', gap: '0.5rem' }}>
                   <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--border-light)', overflow: 'hidden', flexShrink: 0 }}>
                      {comment.avatarUrl ? <img src={comment.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%', fontSize:'0.8rem'}}>👤</span>}
                   </div>
                   <div>
                     <div style={{ background: 'var(--bg-main)', padding: '0.5rem 0.75rem', borderRadius: '15px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'block', marginBottom: '0.1rem' }}>{comment.authorName}</span>
                        <span style={{ fontSize: '0.9rem' }}>{comment.text}</span>
                     </div>
                     <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>{comment.timestamp}</span>
                   </div>
                </div>
              ))
            )}
          </div>

          {/* Add Comment Input */}
          <form onSubmit={handleSubmit} style={{ padding: '1rem', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="הוסיפו תגובה..." 
              style={{ flex: 1, padding: '0.75rem', borderRadius: '20px', border: '1px solid var(--border-light)' }}
            />
            <button 
              type="submit" 
              disabled={!commentText.trim()}
              style={{ background: 'transparent', border: 'none', color: commentText.trim() ? 'var(--primary)' : 'var(--text-light)', fontWeight: 'bold', cursor: commentText.trim() ? 'pointer' : 'default' }}
            >
              שלח
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

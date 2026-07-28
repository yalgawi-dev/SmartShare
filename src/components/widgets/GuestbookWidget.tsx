'use client';

import { useState, useRef } from 'react';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';
import { compressImage } from '../../utils/imageOptimizer';
import ProfileModal from './ProfileModal';

export default function GuestbookWidget({ space, onRemove, isGuestMode }: { space: any, onRemove?: () => void, isGuestMode?: boolean }) {
  const { addMediaItem, removeMediaItem, likeMediaItem } = useSpaces();
  const { user } = useAuth();
  const [isAddingMsg, setIsAddingMsg] = useState(false);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [inspectedProfile, setInspectedProfile] = useState<any | null>(null);

  const spaceMember = space.members?.find((m: any) => m.userId === user?.id);
  const canUpload = user?.isAdmin || !isGuestMode || (spaceMember?.canUpload ?? true);
  
  const useNicknameGlobally = false;
  const useNickname = spaceMember?.useNickname !== undefined ? spaceMember.useNickname : useNicknameGlobally;
  const displayName = useNickname ? (user?.nickname || user?.realName) : (user?.realName || user?.nickname || 'אורח/ת');
  const displayAvatar = spaceMember?.localAvatarUrl || user?.avatarUrl;

  const messages = (space.mediaItems || []).filter((m: any) => m.type === 'message').sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0));

  // Removed handleAvatarChange

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        alert('הסרטון גדול מדי. הגבלה לעד 50MB (כדקה).');
        return;
      }
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const handleAddMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const content = formData.get('content') as string;

    addMediaItem(space.id, {
      type: 'message',
      authorName: displayName,
      content,
      url: videoPreview || undefined,
      avatarUrl: displayAvatar, 
      authorStatus: user?.status || undefined,
    });
    
    setIsAddingMsg(false);
    setVideoPreview(null);
  };

  return (
    <div className="card glass-panel" style={{ padding: '2rem', marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(250, 245, 255, 0.9))', position: 'relative' }}>
      
      {inspectedProfile && (
        <ProfileModal 
          profile={inspectedProfile} 
          onClose={() => setInspectedProfile(null)} 
        />
      )}
      
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
          {canUpload && (
            <button 
              onClick={() => setIsAddingMsg(true)}
              style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <span>+ כתוב ברכה</span>
            </button>
          )}
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
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div 
                style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}
              >
                {displayAvatar ? <img src={displayAvatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user?.gender === 'male' ? '👦' : user?.gender === 'female' ? '👧' : '👤')}
              </div>
              <div style={{ flex: 1, padding: '0.75rem', borderRadius: '4px', background: 'var(--bg-main)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                <span>מאת: </span><strong>{displayName}</strong>
              </div>
            </div>

            <textarea name="content" placeholder="איחולים לבביים... (אופציונלי אם מצלמים וידאו)" rows={3} style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-light)', resize: 'vertical' }} />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button type="button" onClick={() => videoInputRef.current?.click()} style={{ background: 'var(--bg-card)', border: '1px dashed var(--primary)', padding: '0.75rem', borderRadius: '4px', cursor: 'pointer', color: 'var(--primary)', fontWeight: 'bold' }}>
                🎥 צלם ברכת וידאו (סלפי)
              </button>
              <input type="file" accept="video/mp4,video/quicktime" capture="user" ref={videoInputRef} onChange={handleVideoChange} style={{ display: 'none' }} />
              {videoPreview && (
                <div style={{ marginTop: '0.5rem' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>צפייה מקדימה:</p>
                  <video src={videoPreview} controls style={{ width: '100%', maxHeight: '200px', borderRadius: '8px', background: 'black' }} />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button type="submit" style={{ flex: 1, background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>שלח ברכה ❤️</button>
              <button type="button" onClick={() => { setIsAddingMsg(false); setVideoPreview(null); }} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-light)', padding: '0.75rem', borderRadius: '4px', cursor: 'pointer' }}>ביטול</button>
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
              {/* Delete Button */}
              {(!isGuestMode || spaceMember?.canDelete || user?.isAdmin) && (
                <button onClick={() => removeMediaItem(space.id, msg.id)} style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', background: 'rgba(255,0,0,0.1)', color: 'red', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.8rem' }} title="מחק ברכה">
                  🗑️
                </button>
              )}
              
              {/* Like Button */}
              <div style={{ position: 'absolute', top: '0.5rem', left: !isGuestMode ? '2.5rem' : '0.5rem' }}>
                <button 
                  onClick={() => likeMediaItem(space.id, msg.id)} 
                  style={{ background: 'rgba(255, 105, 180, 0.1)', color: 'hotpink', border: '1px solid rgba(255, 105, 180, 0.3)', borderRadius: '20px', padding: '0.15rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                >
                  ❤️ {msg.likes || 0}
                </button>
              </div>

              {/* Author Header */}
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}
                onClick={() => setInspectedProfile({
                  name: msg.authorName,
                  avatarUrl: msg.avatarUrl,
                  status: msg.authorStatus,
                  isCurrentUser: profile?.name === msg.authorName
                })}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--border-light)', overflow: 'hidden' }}>
                  {msg.avatarUrl ? <img src={msg.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user?.gender === 'male' ? '👦' : user?.gender === 'female' ? '👧' : '👤')}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{msg.authorName}</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{msg.timestamp}</span>
                </div>
              </div>

              {/* Video Greeting */}
              {msg.url && (
                <div style={{ marginBottom: '1rem', borderRadius: '8px', overflow: 'hidden', background: 'black' }}>
                  <video src={msg.url} controls style={{ width: '100%', display: 'block' }} />
                </div>
              )}

              {/* Text Content */}
              {msg.content && (
                <p style={{ fontSize: '1.05rem', lineHeight: '1.5', margin: 0, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useRef, useMemo } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';
import MessageEditor from '../shared/MessageEditor';
import { compressImage } from '../../utils/imageOptimizer';

// @ts-ignore
const FlipBook = HTMLFlipBook as any;

const Page = React.forwardRef((props: any, ref: any) => {
  return (
    <div className="page" ref={ref} style={{ ...props.style, backgroundColor: props.isCover ? 'transparent' : '#fdfdfd', borderRight: props.isCover ? 'none' : '1px solid #ddd', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div className="page-content" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', transform: 'scaleX(-1)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', boxSizing: 'border-box' }}>
        {props.children}
      </div>
    </div>
  );
});
Page.displayName = 'Page';

const SIZES = {
  'A3-landscape': { width: 500, height: 350, itemsPerPage: 3, name: 'A3 רוחבי (ענק)' },
  'A4-landscape': { width: 400, height: 280, itemsPerPage: 2, name: 'A4 רוחבי (גדול)' },
  'A4-portrait': { width: 350, height: 500, itemsPerPage: 2, name: 'A4 אנכי (קלאסי)' },
  'square': { width: 400, height: 400, itemsPerPage: 1, name: 'ריבוע (מודרני)' },
};

export default function AlbumWidget({ space, isGuestMode }: { space: any, isGuestMode?: boolean }) {
  const { addMediaItem, removeMediaItem, updateMediaItem, updateAlbumSettings, updateAtmospherePhoto, moveMediaItem, updateSpaceCover } = useSpaces();
  const { user } = useAuth();
  
  const [isAddingMsg, setIsAddingMsg] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [viewMode, setViewMode] = useState<'album' | 'wall'>('album');
  const [currentPage, setCurrentPage] = useState(0);
  
  const [draggedItem, setDraggedItem] = useState<{ id: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const atmosphereInputRef = useRef<HTMLInputElement>(null);
  const replacePhotoRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [replacePhotoIndex, setReplacePhotoIndex] = useState<number | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const flipBookRef = useRef<any>(null);

  const spaceMember = space.members?.find((m: any) => m.userId === user?.id);
  const canUpload = true; // Temporary fix to ensure button is visible for everyone
  const isOwner = !isGuestMode; 
  
  const useNicknameGlobally = user?.hideRealName || false;
  const useNickname = spaceMember?.useNickname !== undefined ? spaceMember.useNickname : useNicknameGlobally;
  const displayName = useNickname && user?.nickname ? user.nickname : (user?.realName || user?.nickname || 'אורח/ת');
  const displayAvatar = spaceMember?.localAvatarUrl || user?.avatarUrl;

  const currentSizeKey = (space.albumSize || 'A4-landscape') as keyof typeof SIZES;
  const currentSize = SIZES[currentSizeKey];
  const atmospherePhotos = (space.albumAtmospherePhotos || [])
    .map((url: string, idx: number) => ({ url, originalIndex: idx }))
    .filter((photo: any) => Boolean(photo.url));

  const messages = useMemo(() => {
    return (space.mediaItems || []).filter((m: any) => m.type === 'message');
  }, [space.mediaItems]);

  const albumPages = useMemo(() => {
    const pages: any[] = [];
    const sorted = [...messages].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Group dynamically without explicit slots
    let currentPageIndex = 0;
    
    // Pass 1: Add Atmosphere Photos and greetings
    let msgIndex = 0;
    let photoIndex = 0;

    while (msgIndex < sorted.length || photoIndex < atmospherePhotos.length) {
      if (currentPageIndex % 2 === 0 && photoIndex < atmospherePhotos.length) {
        // Even pages get atmosphere photos if available
        pages.push(['FULL_PHOTO', atmospherePhotos[photoIndex].url, atmospherePhotos[photoIndex].originalIndex]);
        photoIndex++;
      } else {
        // Odd pages or when out of photos get greetings
        const chunk = sorted.slice(msgIndex, msgIndex + currentSize.itemsPerPage);
        pages.push(chunk);
        msgIndex += currentSize.itemsPerPage;
      }
      currentPageIndex++;
    }

    // Ensure we have at least a few pages and it ends on an even number
    while (pages.length < 4) pages.push([]);
    if (pages.length % 2 !== 0) pages.push([]);

    return pages;
  }, [messages, currentSize.itemsPerPage, atmospherePhotos]);

  const totalPages = albumPages.length + 2; // + covers

  const handleAtmosphereUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      try {
        const compressedUrls = await Promise.all(
          files.map(f => compressImage(f, 1200, 1200, 0.7))
        );
        updateAlbumSettings(space.id, currentSizeKey, compressedUrls);
      } catch (err) {
        console.error("Failed to compress atmosphere photos:", err);
      }
    }
  };

  const handleReplacePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && replacePhotoIndex !== null) {
      try {
        const compressed = await compressImage(file, 1200, 1200, 0.7);
        updateAtmospherePhoto(space.id, replacePhotoIndex, compressed);
        setReplacePhotoIndex(null);
      } catch (err) {
        console.error("Failed to compress replacement photo:", err);
      }
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && updateSpaceCover) {
      try {
        const compressed = await compressImage(file, 1200, 1200, 0.7);
        updateSpaceCover(space.id, compressed);
      } catch (err) {
        console.error("Failed to compress cover photo:", err);
      }
    }
  };

  const openEditMessage = (msg: any) => {
    setEditingMsgId(msg.id);
    setIsAddingMsg(true);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, mediaId: string) => {
    e.dataTransfer.setData('text/plain', mediaId);
    setDraggedItem({ id: mediaId });
  };
  
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  
  const handleDrop = (e: React.DragEvent, pageIdx: number) => {
    e.preventDefault();
    const mediaId = e.dataTransfer.getData('text/plain');
    if (mediaId) {
      // Just visually update timestamp or something to force re-sort?
      // Actually since we removed explicit slots, D&D is harder to implement perfectly.
      // We will skip D&D slot swapping for the dynamic flow layout, or just push it to the end of that page's chunk.
      // For now, edit mode allows deleting.
    }
    setDraggedItem(null);
  };

  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📖 {viewMode === 'album' ? 'אלבום ברכות' : 'קיר ברכות'}
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', borderRadius: 'var(--radius-full)', padding: '0.25rem' }}>
            <button 
              onClick={() => setViewMode('album')} 
              style={{ background: viewMode === 'album' ? 'white' : 'transparent', color: viewMode === 'album' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontWeight: viewMode === 'album' ? 'bold' : 'normal', boxShadow: viewMode === 'album' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
            >
              📖 אלבום
            </button>
            <button 
              onClick={() => setViewMode('wall')} 
              style={{ background: viewMode === 'wall' ? 'white' : 'transparent', color: viewMode === 'wall' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontWeight: viewMode === 'wall' ? 'bold' : 'normal', boxShadow: viewMode === 'wall' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
            >
              📜 קיר גלילה
            </button>
          </div>

          {canUpload && (
            <button onClick={() => { setEditingMsgId(null); setIsAddingMsg(true); }} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
              ✏️ הוסף ברכה
            </button>
          )}
          {isOwner && (
            <>
              <button 
                onClick={() => setIsEditMode(!isEditMode)} 
                style={{ background: isEditMode ? 'var(--primary)' : 'transparent', color: isEditMode ? 'white' : 'var(--text-primary)', border: '1px solid var(--border-light)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-full)', cursor: 'pointer' }}
              >
                ✏️ עריכה
              </button>
              <button 
                onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
                style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-light)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-full)', cursor: 'pointer' }}
              >
                ⚙️ הגדרות אלבום
              </button>
            </>
          )}
        </div>
      </div>

      <input type="file" accept="image/*" ref={replacePhotoRef} onChange={handleReplacePhotoUpload} style={{ display: 'none' }} />

      {isSettingsOpen && isOwner && (
        <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem', border: '1px solid var(--primary)', position: 'relative' }}>
          <button onClick={() => setIsSettingsOpen(false)} style={{ position: 'absolute', top: '10px', left: '10px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
          <h3 style={{ marginTop: 0 }}>הגדרות מתקדמות לאלבום</h3>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <h4>תמונת שער לאלבום:</h4>
            <button onClick={() => coverInputRef.current?.click()} style={{ background: 'white', border: '1px dashed var(--primary)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>
              🖼️ בחר תמונת שער
            </button>
            <input type="file" accept="image/*" ref={coverInputRef} onChange={handleCoverUpload} style={{ display: 'none' }} />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h4>בחר גודל אלבום להדפסה:</h4>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {(Object.keys(SIZES) as Array<keyof typeof SIZES>).map(key => (
                <button 
                  key={key} 
                  onClick={() => updateAlbumSettings(space.id, key, [])}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    borderRadius: '8px', 
                    border: currentSizeKey === key ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                    background: currentSizeKey === key ? 'var(--primary)' : 'white',
                    color: currentSizeKey === key ? 'white' : 'black',
                    cursor: 'pointer'
                  }}
                >
                  {SIZES[key].name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4>העלאת תמונות אווירה (Bulk):</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>העלה מספר תמונות נושא והן יפוזרו اوטומטית כעמודים שלמים (Full Bleed).</p>
            <button onClick={() => atmosphereInputRef.current?.click()} style={{ background: 'white', border: '1px dashed var(--primary)', padding: '1rem', borderRadius: '8px', cursor: 'pointer', width: '200px' }}>
              📷 בחר מספר תמונות...
            </button>
            <input type="file" accept="image/*" multiple ref={atmosphereInputRef} onChange={handleAtmosphereUpload} style={{ display: 'none' }} />
            {atmospherePhotos.length > 0 && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'green' }}>
                ✅ הועלו {atmospherePhotos.length} תמונות נושא.
              </div>
            )}
          </div>
        </div>
      )}

      {isAddingMsg && (
        <MessageEditor 
          title={editingMsgId ? 'ערוך ברכה' : 'ברכה חדשה לאלבום'}
          initialData={editingMsgId ? messages.find((m: any) => m.id === editingMsgId) : null}
          allowVideo={false} // Currently album widget doesn't support video well in flipbook
          onSave={(data) => {
            if (data.id) {
              updateMediaItem(space.id, data.id, {
                content: data.content,
                attachedPhotoUrl: data.attachedPhotoUrl,
                signatureUrl: data.signatureUrl,
                fontFamily: data.fontFamily,
                backgroundColor: data.backgroundColor
              });
            } else {
              addMediaItem(space.id, {
                type: 'message',
                authorName: displayName,
                content: data.content,
                attachedPhotoUrl: data.attachedPhotoUrl,
                signatureUrl: data.signatureUrl,
                avatarUrl: displayAvatar, 
                fontFamily: data.fontFamily,
                backgroundColor: data.backgroundColor
              });
            }
            setIsAddingMsg(false);
            setEditingMsgId(null);
          }}
          onCancel={() => {
            setIsAddingMsg(false);
            setEditingMsgId(null);
          }}
        />
      )}

      {(isEditMode || viewMode === 'wall') ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
          {/* Grid / Wall View */}
          {albumPages.map((pageData, pageIndex) => (
            <div key={pageIndex} style={{ border: '2px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden', height: viewMode === 'wall' ? 'auto' : '400px', minHeight: '300px', background: '#fff', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              {isEditMode && (
                <div style={{ padding: '0.5rem', background: 'var(--bg-main)', borderBottom: '1px solid var(--border-light)', textAlign: 'center', fontWeight: 'bold' }}>
                  עמוד {pageIndex + 1}
                </div>
              )}
              <div style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
                {pageData[0] === 'FULL_PHOTO' ? (
                  <div style={{ flex: 1, background: '#eee', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <img src={pageData[1]} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  pageData.map((msg: any) => (
                    <div 
                      key={msg.id} 
                      style={{ border: '1px solid rgba(0,0,0,0.05)', borderRadius: '12px', background: msg.backgroundColor || '#fff', padding: '0.5rem', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', position: 'relative' }}
                    >
                      <div style={{ fontFamily: msg.fontFamily }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#eee', overflow: 'hidden' }}>
                            {msg.avatarUrl ? <img src={msg.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                          </div>
                          <strong>{msg.authorName}</strong>
                        </div>
                        {msg.attachedPhotoUrl && (
                           <div style={{ width: '100%', borderRadius: '8px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                             <img src={msg.attachedPhotoUrl} style={{ width: '100%', maxHeight: '150px', objectFit: 'cover' }} />
                           </div>
                        )}
                        <div style={{ fontSize: '0.8rem', opacity: 0.8, whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                        {msg.signatureUrl && (
                           <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                             <img src={msg.signatureUrl} style={{ height: '30px', maxWidth: '80px', objectFit: 'contain' }} />
                           </div>
                        )}
                      </div>
                      <div style={{ position: 'absolute', top: 5, left: 5, display: 'flex', gap: '0.3rem' }}>
                        {(user?.isAdmin || msg.authorName === displayName) && (
                          <button onClick={() => openEditMessage(msg)} style={{ background: 'rgba(0,0,0,0.05)', color: '#333', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer' }} title="ערוך">✏️</button>
                        )}
                        <button onClick={() => removeMediaItem(space.id, msg.id)} style={{ background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer' }}>✕</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', background: 'var(--bg-main)', padding: '2rem 0', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
          {currentPage > 0 && (
            <button onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: 'rgba(255,255,255,0.8)', border: 'none', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>▶</button>
          )}
          
          {currentPage < totalPages - 1 && (
            <button onClick={() => flipBookRef.current?.pageFlip()?.flipNext()} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: 'rgba(255,255,255,0.8)', border: 'none', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>◀</button>
          )}
          
          <div style={{ transform: 'scaleX(-1)' }} className="flipbook-rtl-wrapper">
            <FlipBook
              ref={flipBookRef}
              width={currentSize.width}
              height={currentSize.height}
              size="fixed"
              minWidth={300}
              maxWidth={600}
              minHeight={400}
              maxHeight={800}
              maxShadowOpacity={0.5}
              showCover={true}
              usePortrait={false}
              drawShadow={true}
              mobileScrollSupport={true}
              onFlip={(e: any) => setCurrentPage(e.data)}
              className="demo-book"
              style={{ margin: '0 auto', boxShadow: '0 0 20px rgba(0,0,0,0.2)' }}
            >
              {/* Cover */}
              <Page isCover={true} style={{ padding: 0 }}>
                <div style={{ background: 'var(--primary)', color: 'white', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                   {space.coverImage && (
                     <img src={space.coverImage} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                   )}
                   <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: '8px' }}>
                    <h2 style={{ fontSize: '2.5rem', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>ספר הברכות</h2>
                    <h3 style={{ fontSize: '1.5rem', margin: 0, opacity: 0.9, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>של {space.name}</h3>
                   </div>
                </div>
              </Page>

              {/* Inner Pages */}
              {albumPages.map((pageData, pageIndex) => (
                <Page key={`page-${pageIndex}`}>
                  {pageData[0] === 'FULL_PHOTO' ? (
                    <div 
                      style={{ height: '100%', width: '100%', position: 'relative', background: '#000', display: 'block' }}
                    >
                      <img src={pageData[1]} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      
                      {isOwner && (
                        <button 
                          className="replace-btn"
                          style={{ position: 'absolute', bottom: '1rem', right: '1rem', background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', padding: '0.5rem 1rem', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', gap: '0.5rem', alignItems: 'center', backdropFilter: 'blur(4px)', zIndex: 10 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setReplacePhotoIndex(pageData[2]);
                            replacePhotoRef.current?.click();
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          📷 החלף תמונה
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '1.5rem', overflowY: 'auto', boxSizing: 'border-box' }}>
                      <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '1rem', textAlign: 'center' }}>{pageIndex + 1}</div>
                      
                      {/* Dynamic Greetings Layout */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
                        {pageData.map((msg: any) => {
                          const canEdit = !isGuestMode || spaceMember?.canDelete || user?.isAdmin || msg.authorName === displayName;
                          return (
                            <div 
                              key={msg.id} 
                              onClick={(e) => {
                                if (canEdit) {
                                  e.stopPropagation();
                                  openEditMessage(msg);
                                }
                              }}
                              onPointerDown={(e) => {
                                if (canEdit) e.stopPropagation();
                              }}
                              style={{ flex: '0 0 auto', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '12px', display: 'flex', flexDirection: 'column', background: msg.backgroundColor || 'white', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', overflow: 'hidden', position: 'relative', width: '100%', boxSizing: 'border-box', cursor: canEdit ? 'pointer' : 'default', transition: 'transform 0.2s, box-shadow 0.2s' }}
                              onMouseEnter={(e) => { if (canEdit) { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.08)'; } }}
                              onMouseLeave={(e) => { if (canEdit) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.03)'; } }}
                            >
                               <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', fontFamily: msg.fontFamily || 'Heebo', width: '100%', boxSizing: 'border-box' }}>
                               {msg.attachedPhotoUrl && (
                                 <div style={{ width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
                                   <img src={msg.attachedPhotoUrl} style={{ width: '100%', maxHeight: '200px', objectFit: 'cover' }} />
                                 </div>
                               )}
                               {msg.content && (
                                 <div style={{ margin: 0, fontSize: msg.fontFamily === 'Amatic SC' ? '1.5rem' : '1.1rem', whiteSpace: 'pre-wrap' }}>
                                   {msg.content}
                                 </div>
                               )}
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#eee', overflow: 'hidden' }}>
                                      {msg.avatarUrl ? <img src={msg.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                                    </div>
                                    <span style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>{msg.authorName}</span>
                                  </div>
                                  {msg.signatureUrl && <img src={msg.signatureUrl} style={{ height: '35px', maxWidth: '100px', objectFit: 'contain' }} />}
                               </div>
                               
                               {canEdit && (
                                  <div style={{ position: 'absolute', top: 5, left: 5, display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={(e) => { e.stopPropagation(); openEditMessage(msg); }} style={{ background: 'rgba(0,0,0,0.05)', color: '#333', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.9rem' }} title="ערוך">
                                      ✏️
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); removeMediaItem(space.id, msg.id); }} style={{ background: 'rgba(255,0,0,0.1)', color: 'red', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.9rem' }} title="מחק">
                                      ✕
                                    </button>
                                  </div>
                                )}
                             </div>
                          </div>
                        );
                        })}
                      </div>
                    </div>
                  )}
                </Page>
              ))}

              <Page isCover={true} style={{ padding: 0 }}>
                <div style={{ background: 'transparent', width: '100%', height: '100%' }}></div>
              </Page>
            </FlipBook>
          </div>
        </div>
      )}
    </div>
  );
}

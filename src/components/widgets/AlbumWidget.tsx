'use client';

import React, { useState, useRef, useMemo } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';
import MessageEditor from '../shared/MessageEditor';
import DraggableElement from '../shared/DraggableElement';
import StickerToolbox from '../shared/StickerToolbox';
import { compressImage } from '../../utils/imageOptimizer';
import { renderSticker } from '../../utils/stickers';

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
  const [isPhotosManagerOpen, setIsPhotosManagerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStickerToolboxOpen, setIsStickerToolboxOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [viewMode, setViewMode] = useState<'album' | 'wall'>('album');
  const [currentPage, setCurrentPage] = useState(0);
  
  const [draggedItem, setDraggedItem] = useState<{ id: string } | null>(null);
  const [clipboardMsgId, setClipboardMsgId] = useState<string | null>(null);
  
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
        let currentPageCost = 0;
        const maxPageCost = currentSize.height * 0.9; 
        const chunk = [];
        
        while (msgIndex < sorted.length) {
          const msg = sorted[msgIndex];
          
          let cost = 120;
          if (msg.stickerId) cost = 100;
          else {
             if (msg.content) cost += msg.content.length * 1.5;
             if (msg.attachedPhotoUrl || msg.url) cost += 300;
             if (msg.isCard) cost += 80;
             if (msg.fontSize) cost += (msg.fontSize * 20);
          }
          
          if (currentPageCost + cost > maxPageCost && chunk.length > 0) {
             break; 
          }
          
          chunk.push(msg);
          currentPageCost += cost;
          msgIndex++;
        }
        
        if (chunk.length > 0) {
          pages.push(chunk);
        }
      }
      currentPageIndex++;
    }

    // Ensure we have at least a few pages and it ends on an even number
    while (pages.length < 4) pages.push([]);
    if (pages.length % 2 !== 0) pages.push([]);

    return pages;
  }, [messages, currentSize.itemsPerPage, atmospherePhotos]);

  const totalPages = albumPages.length + 2; // + covers

  const handlePaste = (pageIndex: number, pageData: any[]) => {
    if (!clipboardMsgId) return;
    
    let newTimestamp = new Date().toISOString();
    try {
      if (pageData.length > 0) {
         const lastMsg = pageData[pageData.length - 1];
         const lastTime = lastMsg.timestamp ? new Date(lastMsg.timestamp).getTime() : Date.now();
         newTimestamp = new Date(lastTime + 1000).toISOString();
      } else {
         if (pageIndex > 0) {
           const prevPage = albumPages[pageIndex - 1];
           if (prevPage && prevPage.length > 0 && prevPage[0] !== 'FULL_PHOTO') {
              const lastPrev = prevPage[prevPage.length - 1];
              const lastTime = lastPrev.timestamp ? new Date(lastPrev.timestamp).getTime() : Date.now();
              newTimestamp = new Date(lastTime + 5000).toISOString();
           }
         }
      }
    } catch (e) {
      newTimestamp = new Date().toISOString();
    }
    
    updateMediaItem(space.id, clipboardMsgId, { timestamp: newTimestamp });
    setClipboardMsgId(null);
  };

  const handleAtmosphereUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      try {
        const compressedUrls = await Promise.all(
          files.map(async (f) => {
             const compressed = await compressImage(f, 1200, 1200, 0.7);
             const path = `spaces/atmosphere/${space.id}_${Date.now()}_${Math.random()}.jpg`;
             return await uploadImageToStorage(compressed, path);
          })
        );
        updateAlbumSettings(space.id, currentSizeKey, [...(space.albumAtmospherePhotos || []), ...compressedUrls]);
      } catch (err) {
        console.error("Failed to compress and upload atmosphere photos:", err);
      }
    }
  };

  const handleReplacePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && replacePhotoIndex !== null && updateAtmospherePhoto) {
      try {
        const compressed = await compressImage(file, 800, 800, 0.7);
        const path = `spaces/atmosphere/${space.id}_${Date.now()}.jpg`;
        const url = await uploadImageToStorage(compressed, path);
        updateAtmospherePhoto(space.id, replacePhotoIndex, url);
        setReplacePhotoIndex(null);
      } catch (err) {
        console.error("Failed to compress and upload replacement photo:", err);
      }
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && updateSpaceCover) {
      try {
        const compressed = await compressImage(file, 1200, 1200, 0.7);
        const path = `spaces/covers/${space.id}_${Date.now()}.jpg`;
        const url = await uploadImageToStorage(compressed, path);
        updateSpaceCover(space.id, url);
      } catch (err) {
        console.error("Failed to compress and upload cover photo:", err);
      }
    }
  };

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

  // Restore FlipBook page if it resets due to children changes (like live preview)
  React.useEffect(() => {
    if (flipBookRef.current && (flipBookRef.current as any).pageFlip) {
      try {
        const pageFlip = (flipBookRef.current as any).pageFlip();
        if (pageFlip && typeof pageFlip.getCurrentPageIndex === 'function') {
          const currentFlipPage = pageFlip.getCurrentPageIndex();
          if (currentFlipPage !== currentPage && currentFlipPage === 0 && currentPage > 0) {
            pageFlip.turnToPage(currentPage);
          }
        }
      } catch (e) {
        // ignore errors if pageFlip isn't fully initialized
      }
    }
  }, [messages, currentPage, isEditMode, isStickerToolboxOpen, isPhotosManagerOpen, isSettingsOpen, isAddingMsg, editingMsgId]);

  return (
    <div style={{ marginTop: '2rem', position: 'relative' }}>
      <StickerToolbox 
        isOpen={isStickerToolboxOpen} 
        onClose={() => setIsStickerToolboxOpen(false)} 
        onAddSticker={handleAddSticker}
      />
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
                onClick={() => {
                  const newEditMode = !isEditMode;
                  setIsEditMode(newEditMode);
                  setIsStickerToolboxOpen(newEditMode); // Auto open when entering edit mode, close when exiting
                }} 
                style={{ background: isEditMode ? 'var(--primary)' : 'transparent', color: isEditMode ? 'white' : 'var(--text-primary)', border: '1px solid var(--border-light)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-full)', cursor: 'pointer' }}
              >
                ✏️ עריכה
              </button>
              {isEditMode && (
                <button 
                  onClick={() => setIsStickerToolboxOpen(!isStickerToolboxOpen)} 
                  style={{ background: isStickerToolboxOpen ? 'var(--primary-light)' : 'transparent', color: 'var(--primary)', border: '1px dashed var(--primary)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  🎨 חומרי יצירה
                </button>
              )}
              <button 
                onClick={() => setIsPhotosManagerOpen(!isPhotosManagerOpen)} 
                style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-light)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-full)', cursor: 'pointer' }}
              >
                🖼️ ניהול תמונות
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
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>העלה מספר תמונות נושא והן יפוזרו אוטומטית כעמודים שלמים (Full Bleed).</p>
            <button onClick={() => atmosphereInputRef.current?.click()} style={{ background: 'white', border: '1px dashed var(--primary)', padding: '1rem', borderRadius: '8px', cursor: 'pointer', width: '200px' }}>
              📷 בחר מספר תמונות...
            </button>
            <input type="file" accept="image/*" multiple ref={atmosphereInputRef} onChange={handleAtmosphereUpload} style={{ display: 'none' }} />
          </div>
        </div>
      )}

      {isPhotosManagerOpen && isOwner && (
        <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem', border: '1px solid var(--primary)', position: 'relative' }}>
          <button onClick={() => setIsPhotosManagerOpen(false)} style={{ position: 'absolute', top: '10px', left: '10px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
          <h3 style={{ marginTop: 0 }}>ניהול תמונות אווירה</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>כאן תוכל למחוק או להחליף תמונות קיימות, ולהעלות חדשות.</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            {atmospherePhotos.map((photo, index) => (
              <div key={index} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', height: '120px', border: '1px solid var(--border-light)' }}>
                <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={`Atmosphere ${index}`} />
                <div style={{ position: 'absolute', top: 5, right: 5, display: 'flex', gap: '0.2rem' }}>
                  <button onClick={() => {
                    setReplacePhotoIndex(index);
                    replacePhotoRef.current?.click();
                  }} style={{ background: 'rgba(255,255,255,0.8)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '0.8rem' }} title="החלף תמונה">🔄</button>
                  <button onClick={() => {
                    const newPhotos = [...atmospherePhotos];
                    newPhotos.splice(index, 1);
                    updateAlbumSettings(space.id, currentSizeKey, newPhotos);
                  }} style={{ background: 'rgba(255,0,0,0.8)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '0.8rem' }} title="מחק תמונה">✕</button>
                </div>
              </div>
            ))}
            
            <button onClick={() => atmosphereInputRef.current?.click()} style={{ background: 'rgba(0,0,0,0.02)', border: '2px dashed var(--border-light)', borderRadius: '8px', height: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <span style={{ fontSize: '2rem' }}>+</span>
              <span style={{ fontSize: '0.8rem' }}>הוסף תמונות</span>
            </button>
          </div>
        </div>
      )}

      {isAddingMsg && (
        <MessageEditor 
          title={editingMsgId ? 'ערוך ברכה' : 'ברכה חדשה לאלבום'}
          initialData={editingMsgId ? messages.find((m: any) => m.id === editingMsgId) : null}
          allowVideo={false} // Currently album widget doesn't support video well in flipbook
          onChange={(data) => {
            if (editingMsgId) {
              updateMediaItem(space.id, editingMsgId, {
                content: data.content,
                fontFamily: data.fontFamily,
                backgroundColor: data.backgroundColor,
                textColor: data.textColor,
                fontSize: data.fontSize,
                rotation: data.rotation,
                isCard: data.isCard,
                stickerId: data.stickerId,
                isBold: data.isBold,
                isUnderline: data.isUnderline
              });
            }
          }}
          onSave={(data) => {
            if (data.id) {
              updateMediaItem(space.id, data.id, {
                content: data.content,
                attachedPhotoUrl: data.attachedPhotoUrl,
                signatureUrl: data.signatureUrl,
                fontFamily: data.fontFamily,
                backgroundColor: data.backgroundColor,
                textColor: data.textColor,
                fontSize: data.fontSize,
                rotation: data.rotation,
                isCard: data.isCard,
                stickerId: data.stickerId,
                isBold: data.isBold,
                isUnderline: data.isUnderline
              });
            } else {
              addMediaItem(space.id, {
                type: 'message',
                authorName: displayName,
                authorId: user?.id,
                content: data.content,
                attachedPhotoUrl: data.attachedPhotoUrl,
                signatureUrl: data.signatureUrl,
                url: data.videoUrl,
                avatarUrl: displayAvatar, 
                fontFamily: data.fontFamily,
                backgroundColor: data.backgroundColor,
                textColor: data.textColor,
                fontSize: data.fontSize,
                rotation: data.rotation,
                isCard: data.isCard,
                stickerId: data.stickerId,
                isBold: data.isBold,
                isUnderline: data.isUnderline
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

      {viewMode === 'wall' ? (
        <div style={{ columnCount: window.innerWidth > 1000 ? 3 : window.innerWidth > 700 ? 2 : 1, columnGap: '2rem', padding: '2rem', width: '100%', boxSizing: 'border-box' }}>
          {messages.map((msg: any) => {
             // Deterministic random rotation based on ID string
             const hash = msg.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
             const rotation = msg.rotation !== undefined ? msg.rotation : ((hash % 7) - 3);

             return (
               <div 
                 key={`msg-${msg.id}`} 
                 style={{ 
                   breakInside: 'avoid', 
                   marginBottom: '2rem', 
                   background: msg.backgroundColor || '#fff', 
                   padding: '1.5rem', 
                   boxShadow: '2px 4px 15px rgba(0,0,0,0.1), 0 0 40px rgba(0,0,0,0.03) inset', 
                   position: 'relative',
                   transform: `rotate(${rotation}deg)`,
                   transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                   cursor: 'default'
                 }}
                 onMouseEnter={(e) => {
                   e.currentTarget.style.transform = `scale(1.02) rotate(${rotation}deg)`;
                   e.currentTarget.style.boxShadow = '4px 8px 25px rgba(0,0,0,0.15), 0 0 40px rgba(0,0,0,0.03) inset';
                   e.currentTarget.style.zIndex = '10';
                 }}
                 onMouseLeave={(e) => {
                   e.currentTarget.style.transform = `rotate(${rotation}deg)`;
                   e.currentTarget.style.boxShadow = '2px 4px 15px rgba(0,0,0,0.1), 0 0 40px rgba(0,0,0,0.03) inset';
                   e.currentTarget.style.zIndex = '1';
                 }}
               >
                 <div style={{ fontFamily: msg.fontFamily }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                     <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#eee', overflow: 'hidden' }}>
                       {msg.avatarUrl ? <img src={msg.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                     </div>
                     <strong style={{ fontSize: '1.1rem' }}>{msg.authorName}</strong>
                   </div>
                   {msg.attachedPhotoUrl && (
                      <div style={{ width: '100%', padding: '0.5rem', background: 'white', border: '1px solid #ddd', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '1rem', transform: 'rotate(1deg)' }}>
                        <img src={msg.attachedPhotoUrl} style={{ width: '100%', objectFit: 'cover' }} />
                      </div>
                   )}
                   {msg.url && (
                      <div style={{ width: '100%', padding: '0.5rem', background: 'white', border: '1px solid #ddd', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '1rem', transform: 'rotate(-1deg)' }}>
                        <video src={msg.url} controls style={{ width: '100%', display: 'block' }} />
                      </div>
                   )}
                   <div style={{ fontSize: msg.fontFamily === 'Amatic SC' ? '1.5rem' : '1.1rem', opacity: 0.9, whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{msg.content}</div>
                   {msg.signatureUrl && (
                      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <img src={msg.signatureUrl} style={{ height: '40px', maxWidth: '120px', objectFit: 'contain' }} />
                      </div>
                   )}
                 </div>
                 <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: '0.5rem', opacity: isEditMode ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: isEditMode ? 'auto' : 'none' }}>
                   {(user?.isAdmin || (msg.authorId && msg.authorId === user?.id) || msg.authorName === displayName) && (
                     <>
                       <button onClick={() => openEditMessage(msg)} style={{ background: 'rgba(255,255,255,0.9)', color: '#333', border: '1px solid #ddd', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }} title="ערוך">✏️</button>
                       <button onClick={() => removeMediaItem(space.id, msg.id)} style={{ background: 'rgba(255,0,0,0.8)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }} title="מחק">✕</button>
                     </>
                   )}
                 </div>
                 
                 {/* Visual indicator for edit mode */}
                 {isEditMode && <div style={{ position: 'absolute', inset: 0, border: '2px dashed var(--primary)', borderRadius: '12px', pointerEvents: 'none', zIndex: 1 }} />}
               </div>
             );
          })}
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
              useMouseEvents={!isEditMode} // Disable page flipping via mouse when in edit mode
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
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '1.5rem', overflowY: 'hidden', boxSizing: 'border-box' }}>
                      <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '1rem', textAlign: 'center' }}>{pageIndex + 1}</div>
                      
                      {/* Freeform Canvas Layout */}
                      <div style={{ position: 'relative', width: '100%', height: '100%', boxSizing: 'border-box' }}>
                        {isEditMode && clipboardMsgId && (
                           <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <button
                                onClick={() => handlePaste(pageIndex, pageData)}
                                style={{ padding: '1rem 2rem', fontSize: '1.2rem', background: '#3b82f6', color: 'white', borderRadius: '30px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}
                              >
                                📋 הדבק ברכה בעמוד זה
                              </button>
                           </div>
                        )}
                        {pageData.map((msg: any, idx: number) => {
                          const hash = msg.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
                          
                          // Auto Layout: grid based with noise to prevent overlapping
                          const cols = Math.max(1, Math.floor(currentSize.width / 260)); // ~250px per item
                          const row = Math.floor(idx / cols);
                          const col = idx % cols;
                          
                          const defaultX = (col * 260) + 15 + (hash % 20); // base + noise
                          const defaultY = (row * 180) + 20 + ((hash * 7) % 30); // base + noise
                          const defaultRotation = ((hash % 15) - 7);
                          
                          const x = msg.x !== undefined ? msg.x : defaultX;
                          const y = msg.y !== undefined ? msg.y : defaultY;
                          const rotation = msg.rotation !== undefined ? msg.rotation : defaultRotation;
                          const scale = msg.scale || 1;
                          
                          return (
                            <DraggableElement
                              key={msg.id}
                              id={msg.id}
                              x={x}
                              y={y}
                              rotation={rotation}
                              scale={scale}
                              zIndex={msg.zIndex || 1}
                              isEditMode={isEditMode}
                              isSelected={editingMsgId === msg.id}
                              onSelect={setEditingMsgId}
                              onClick={() => {
                                if (isEditMode) {
                                  openEditMessage(msg);
                                }
                              }}
                              onChange={(id, updates) => {
                                // Real-time local state update
                                updateMediaItem(space.id, id, updates);
                              }}
                            >
                              <div 
                                style={{ 
                                  position: 'relative', width: '250px', boxSizing: 'border-box',
                                  ...(msg.isCard ? {
                                    background: msg.backgroundColor || 'white',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(0,0,0,0.1)',
                                    boxShadow: '2px 4px 10px rgba(0,0,0,0.1)'
                                  } : {
                                    background: 'transparent', border: 'none'
                                  })
                                }}
                              >
                                {msg.stickerId && !msg.content && !msg.attachedPhotoUrl ? (
                                  <div style={{ fontSize: '4rem', textAlign: 'center', margin: '0', display: 'flex', justifyContent: 'center' }}>
                                    {renderSticker(msg.stickerId, 100)}
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontFamily: msg.fontFamily || 'Heebo', width: '100%', boxSizing: 'border-box', color: 'var(--text-primary)', position: 'relative' }}>
                                    {msg.stickerId && (
                                      <div style={{ 
                                        position: 'absolute', 
                                        ...(msg.stickerPosition === 'top-left' ? { top: '-15px', left: '-15px' } : 
                                            msg.stickerPosition === 'bottom-right' ? { bottom: '-15px', right: '-15px' } :
                                            msg.stickerPosition === 'bottom-left' ? { bottom: '-15px', left: '-15px' } :
                                            { top: '-15px', right: '-15px' }), // Default top-right
                                        fontSize: '2rem', 
                                        transform: 'rotate(15deg)', 
                                        zIndex: 5 
                                      }}>
                                        {renderSticker(msg.stickerId, 48)}
                                      </div>
                                    )}
                                    {msg.attachedPhotoUrl && (
                                      <div style={{ width: '100%', padding: '0.5rem', background: 'white', border: '1px solid #ddd', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                        <img src={msg.attachedPhotoUrl} style={{ width: '100%', maxHeight: '200px', objectFit: 'cover' }} />
                                      </div>
                                    )}
                                    {msg.content && (
                                      <div style={{ margin: 0, fontSize: msg.fontSize ? `${msg.fontSize}rem` : (['Amatic SC', 'Caveat', 'Karantina', '"Guttman Yad", "Ktav Yad", cursive', '"Gveret Levin", cursive', 'Kalam', '"Guttman Mantova", "Dana Yad", cursive', '"Varela Round", "Assistant", sans-serif'].includes(msg.fontFamily) ? '1.8rem' : '1.1rem'), whiteSpace: 'pre-wrap', lineHeight: '1.4', fontWeight: msg.isBold ? 'bold' : 'normal', textDecoration: msg.isUnderline ? 'underline' : 'none', color: msg.textColor || '#000000' }}>
                                        {msg.content}
                                      </div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginTop: '0.5rem', gap: '1rem', opacity: 0.8 }}>
                                       {msg.signatureUrl ? (
                                          <img src={msg.signatureUrl} style={{ height: '30px', maxWidth: '100px', objectFit: 'contain' }} />
                                       ) : (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontStyle: 'italic', fontSize: '0.9rem' }}>
                                            <span>באהבה, </span>
                                            <strong>{msg.authorName}</strong>
                                          </div>
                                       )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Action Buttons overlay (Edit/Delete) */}
                                <div style={{ position: 'absolute', top: -15, left: -15, display: 'flex', gap: '0.5rem', opacity: isEditMode ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: isEditMode ? 'auto' : 'none', zIndex: 10 }}>
                                  {(user?.isAdmin || (msg.authorId && msg.authorId === user?.id) || msg.authorName === displayName) && (
                                    <>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); openEditMessage(msg); }} 
                                        onPointerDown={(e) => e.stopPropagation()}
                                        style={{ background: 'white', color: '#333', border: '1px solid #ddd', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }} 
                                        title="ערוך"
                                      >✏️</button>
                                      <button 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          setClipboardMsgId(msg.id); 
                                          alert('הברכה נגזרה! עבור לעמוד הרצוי באלבום ולחץ על הכפתור החדש שיופיע "הדבק ברכה בעמוד זה".'); 
                                        }} 
                                        onPointerDown={(e) => e.stopPropagation()}
                                        style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }} 
                                        title="גזור להעברה לעמוד אחר"
                                      >✂️</button>
                                      <button 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          if (confirm('האם אתה בטוח שברצונך למחוק ברכה זו לצמיתות? הפעולה לא ניתנת לביטול.')) {
                                            removeMediaItem(space.id, msg.id); 
                                          }
                                        }} 
                                        onPointerDown={(e) => e.stopPropagation()}
                                        style={{ background: 'rgba(255,0,0,0.8)', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }} 
                                        title="מחק"
                                      >✕</button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </DraggableElement>
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

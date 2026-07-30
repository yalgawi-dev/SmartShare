'use client';

import React, { useState, useRef } from 'react';
import { SVG_ELEMENTS, renderSticker } from '../../utils/stickers';

const STICKER_CATEGORIES: Record<string, string[]> = {
  'איורי קו (לבחירת צבע)': Object.keys(SVG_ELEMENTS).map(name => JSON.stringify({ type: 'svg', name })),
  'רגשות ואהבה': ['❤️', '💖', '💝', '💕', '💞', '💘', '💌', '💋', '😍', '🥰'],
  'מסיבה וימי הולדת': ['🎈', '🎉', '🎊', '🎁', '🎂', '🍰', '🥂', '🍾', '🎇', '✨'],
  'טבע ופרחים': ['🌸', '🌺', '🌹', '🌻', '🌼', '🍀', '🌿', '🦋', '🕊️', '🌈'],
  'קלאסי ואלגנטי': ['⭐', '🌟', '💫', '💎', '👑', '🏆', '🎀', '🎗️', '📌', '📎']
};

interface StickerToolboxProps {
  onAddSticker: (stickerId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function StickerToolbox({ onAddSticker, isOpen, onClose }: StickerToolboxProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [selectedColor, setSelectedColor] = useState('#000000');

  if (!isOpen) return null;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      e.stopPropagation();
      setPos({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div style={{
      position: 'fixed',
      top: '100px',
      right: '20px',
      width: '280px',
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
      border: '1px solid var(--border-light)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transform: `translate(${pos.x}px, ${pos.y}px)`,
      transition: isDragging ? 'none' : 'transform 0.1s'
    }}>
      <div 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ padding: '1rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', cursor: 'grab', userSelect: 'none' }}
      >
        <h3 style={{ margin: 0, fontSize: '1.1rem', pointerEvents: 'none' }}>🎨 חומרי יצירה</h3>
        <button 
          onPointerDown={(e) => e.stopPropagation()} 
          onClick={(e) => { e.stopPropagation(); onClose(); }} 
          style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}
        >
          ✕
        </button>
      </div>
      
      <div style={{ padding: '1rem', overflowY: 'auto', maxHeight: '400px' }}>
        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem', marginTop: 0 }}>
          לחץ על אלמנט כדי להוסיף אותו לעמוד הנוכחי. תוכל לבחור צבע לאיורים השונים!
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #eee' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>בחר צבע לאיורים:</span>
          <input type="color" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} style={{ width: '30px', height: '30px', border: 'none', padding: 0, cursor: 'pointer', borderRadius: '4px' }} />
        </div>
        
        {Object.entries(STICKER_CATEGORIES).map(([categoryName, emojis]) => (
          <div key={categoryName} style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#444' }}>{categoryName}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
              {emojis.map((sticker) => {
                let idToPass = sticker;
                if (sticker.startsWith('{')) {
                  const parsed = JSON.parse(sticker);
                  parsed.color = selectedColor;
                  idToPass = JSON.stringify(parsed);
                }

                return (
                  <button
                    key={sticker}
                    onClick={() => onAddSticker(idToPass)}
                    style={{
                      fontSize: '1.8rem',
                      background: 'rgba(0,0,0,0.02)',
                      border: '1px solid #eee',
                      borderRadius: '8px',
                      padding: '0.5rem 0',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '50px'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {renderSticker(idToPass, 32)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

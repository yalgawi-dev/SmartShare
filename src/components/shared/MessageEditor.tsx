'use client';

import React, { useState, useRef } from 'react';
import SignatureCanvas from '../widgets/SignatureCanvas';
import { compressImage } from '../../utils/imageOptimizer';

export interface MessageData {
  id?: string;
  content?: string;
  attachedPhotoUrl?: string;
  signatureUrl?: string;
  videoUrl?: string;
  fontFamily?: string;
  backgroundColor?: string;
  rotation?: number;
  isCard?: boolean;
  stickerId?: string;
  isBold?: boolean;
  isUnderline?: boolean;
  textColor?: string;
  fontSize?: number;
}

interface MessageEditorProps {
  initialData?: MessageData | null;
  onSave: (data: MessageData) => void;
  onCancel: () => void;
  onChange?: (data: MessageData) => void;
  title?: string;
  allowVideo?: boolean;
}

const TEXT_COLORS = [
  { name: 'שחור', value: '#000000' },
  { name: 'אפור כהה', value: '#333333' },
  { name: 'כחול', value: '#1e3a8a' },
  { name: 'אדום', value: '#991b1b' },
  { name: 'ירוק', value: '#166534' },
  { name: 'סגול', value: '#6b21a8' },
  { name: 'ורוד', value: '#be185d' },
];

const FONT_OPTIONS = [
  { name: 'רגיל', value: 'Heebo' },
  { name: 'כתב יד אותנטי 1', value: '"Guttman Yad", "Ktav Yad", cursive' },
  { name: 'כתב יד אותנטי 2', value: '"Guttman Mantova", "Dana Yad", cursive' },
  { name: 'כתב יד עגול 3', value: 'Kalam' },
];

import { uploadImageToStorage } from '@/lib/firebase';

const BG_COLORS = [
  { name: 'לבן', value: 'white' },
  { name: 'צהוב', value: '#fef3c7' },
  { name: 'ורוד', value: '#fce7f3' },
  { name: 'תכלת', value: '#e0f2fe' },
  { name: 'ירוק', value: '#dcfce7' },
];

export default function MessageEditor({ initialData, onSave, onCancel, onChange, title = 'כתוב ברכה', allowVideo = false }: MessageEditorProps) {
  const [content, setContent] = useState(initialData?.content || '');
  const [selectedFont, setSelectedFont] = useState(initialData?.fontFamily || 'Heebo');
  const [selectedBgColor, setSelectedBgColor] = useState(initialData?.backgroundColor || 'white');
  const [selectedTextColor, setSelectedTextColor] = useState(initialData?.textColor || '#000000');
  const [fontSize, setFontSize] = useState<number>(initialData?.fontSize || 1.1);
  const [rotation, setRotation] = useState<number>(initialData?.rotation || 0);
  const [isCard, setIsCard] = useState<boolean>(initialData?.isCard || false);
  const [isBold, setIsBold] = useState<boolean>(initialData?.isBold || false);
  const [isUnderline, setIsUnderline] = useState<boolean>(initialData?.isUnderline || false);
  const [stickerId, setStickerId] = useState<string | undefined>(initialData?.stickerId);
  const [stickerPosition, setStickerPosition] = useState<string>(initialData?.stickerPosition || 'top-right');
  
  const [attachedPhotoPreview, setAttachedPhotoPreview] = useState<string | null>(initialData?.attachedPhotoUrl || null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(initialData?.signatureUrl || null);
  const [videoPreview, setVideoPreview] = useState<string | null>(initialData?.videoUrl || null);
  const [isUploading, setIsUploading] = useState(false);

  React.useEffect(() => {
    if (onChange) {
      onChange({
        content, fontFamily: selectedFont, backgroundColor: selectedBgColor, 
        textColor: selectedTextColor, fontSize, rotation, isCard, stickerId, stickerPosition,
        isBold, isUnderline, attachedPhotoUrl: attachedPhotoPreview || undefined,
        signatureUrl: signatureUrl || undefined, videoUrl: videoPreview || undefined
      });
    }
  }, [content, selectedFont, selectedBgColor, selectedTextColor, fontSize, rotation, isCard, stickerId, stickerPosition, isBold, isUnderline, attachedPhotoPreview, signatureUrl, videoPreview, onChange]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 800, 800, 0.7);
        setAttachedPhotoPreview(compressed);
      } catch (err) {
        console.error("Failed to compress image:", err);
      }
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        alert('הסרטון גדול מדי. הגבלה לעד 50MB.');
        return;
      }
      setVideoPreview(URL.createObjectURL(file)); 
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !attachedPhotoPreview && !signatureUrl && !videoPreview && !stickerId) return;
    
    setIsUploading(true);
    try {
      let finalPhotoUrl = attachedPhotoPreview;
      if (attachedPhotoPreview && attachedPhotoPreview.startsWith('data:image')) {
        const path = `spaces/media/${Date.now()}_photo.jpg`;
        finalPhotoUrl = await uploadImageToStorage(attachedPhotoPreview, path);
      }
      
      let finalSignatureUrl = signatureUrl;
      if (signatureUrl && signatureUrl.startsWith('data:image')) {
        const path = `spaces/media/${Date.now()}_sig.png`;
        finalSignatureUrl = await uploadImageToStorage(signatureUrl, path);
      }

      onSave({
        id: initialData?.id,
        content,
        fontFamily: selectedFont,
        backgroundColor: selectedBgColor,
        textColor: selectedTextColor,
        fontSize,
        rotation,
        isCard,
        stickerId,
        stickerPosition,
        isBold,
        isUnderline,
        attachedPhotoUrl: finalPhotoUrl || undefined,
        signatureUrl: finalSignatureUrl || undefined,
        videoUrl: videoPreview || undefined
      });
    } catch (err) {
      console.error("Upload failed", err);
      alert("שגיאה בהעלאת התמונות. אנא נסה שנית.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ background: 'white', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem', border: '1px solid var(--border-light)', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', opacity: isUploading ? 0.6 : 1, pointerEvents: isUploading ? 'none' : 'auto' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          
          <div style={{ flex: 1, minWidth: '250px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="כתוב את הברכה שלך כאן..." 
              style={{ padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)', minHeight: '120px', resize: 'vertical', fontFamily: selectedFont, fontSize: `${fontSize}rem`, background: selectedBgColor, color: selectedTextColor, fontWeight: isBold ? 'bold' : 'normal', textDecoration: isUnderline ? 'underline' : 'none' }}
            />
            <SignatureCanvas onSignatureChange={setSignatureUrl} />
          </div>
          
          <div style={{ flex: 1, minWidth: '250px', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px' }}>
            
            {/* Photo Upload */}
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>הוסף תמונה כגלויה:</span>
              <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: 'white', border: '1px dashed var(--primary)', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', width: '100%' }}>📷 בחר תמונה</button>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoChange} style={{ display: 'none' }} />
              {attachedPhotoPreview && <img src={attachedPhotoPreview} style={{ height: '80px', marginTop: '0.5rem', objectFit: 'cover' }} />}
            </div>

            {/* Video Upload (Optional) */}
            {allowVideo && (
              <div>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>הוסף סרטון קצר:</span>
                <button type="button" onClick={() => videoInputRef.current?.click()} style={{ background: 'white', border: '1px dashed var(--primary)', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', width: '100%' }}>🎥 בחר סרטון</button>
                <input type="file" accept="video/*" ref={videoInputRef} onChange={handleVideoChange} style={{ display: 'none' }} />
                {videoPreview && <video src={videoPreview} controls style={{ height: '80px', marginTop: '0.5rem' }} />}
              </div>
            )}

            {/* Font Selection */}
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>סגנון צבע וכתב:</span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <button type="button" onClick={() => setIsBold(!isBold)} style={{ fontWeight: 'bold', padding: '0.2rem 0.5rem', borderRadius: '4px', border: isBold ? '2px solid var(--primary)' : '1px solid var(--border-light)', background: isBold ? 'var(--primary-light)' : 'white', cursor: 'pointer' }}>B</button>
                <button type="button" onClick={() => setIsUnderline(!isUnderline)} style={{ textDecoration: 'underline', padding: '0.2rem 0.5rem', borderRadius: '4px', border: isUnderline ? '2px solid var(--primary)' : '1px solid var(--border-light)', background: isUnderline ? 'var(--primary-light)' : 'white', cursor: 'pointer' }}>U</button>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem', alignItems: 'center' }}>
                {TEXT_COLORS.map(color => (
                  <button key={color.value} type="button" onClick={() => setSelectedTextColor(color.value)} style={{ width: '24px', height: '24px', borderRadius: '50%', background: color.value, border: selectedTextColor === color.value ? '2px solid var(--primary)' : '1px solid #ddd', cursor: 'pointer' }} title={color.name} />
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#666' }}>עוד:</span>
                  <input type="color" value={selectedTextColor} onChange={(e) => setSelectedTextColor(e.target.value)} style={{ width: '24px', height: '24px', padding: 0, border: 'none', cursor: 'pointer', borderRadius: '4px' }} title="בחר צבע מותאם אישית" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {FONT_OPTIONS.map(font => (
                  <button key={font.value} type="button" onClick={() => setSelectedFont(font.value)} style={{ fontFamily: font.value, padding: '0.2rem 0.5rem', borderRadius: '20px', border: selectedFont === font.value ? '2px solid var(--primary)' : '1px solid var(--border-light)', background: selectedFont === font.value ? 'var(--primary)' : 'white', color: selectedFont === font.value ? 'white' : 'black', cursor: 'pointer' }}>{font.name}</button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>גודל:</span>
                <input 
                  type="range" 
                  min="0.8" 
                  max="3" 
                  step="0.1"
                  value={fontSize} 
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            {/* Background Color Selection */}
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>צבע רקע:</span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {BG_COLORS.map(color => (
                  <button key={color.value} type="button" onClick={() => setSelectedBgColor(color.value)} style={{ width: '30px', height: '30px', borderRadius: '50%', background: color.value, border: selectedBgColor === color.value ? '2px solid var(--primary)' : '1px solid #ddd', cursor: 'pointer' }} title={color.name} />
                ))}
              </div>
            </div>

            {/* Rotation Selection */}
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>זווית הצגה (ייחודי לאלבום):</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input 
                  type="range" 
                  min="-15" 
                  max="15" 
                  value={rotation} 
                  onChange={(e) => setRotation(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ width: '40px', textAlign: 'center', fontSize: '0.9rem' }}>{rotation}°</span>
              </div>
            </div>

            {/* Display Style Selection */}
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>סגנון תצוגה באלבום:</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => setIsCard(false)} style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: !isCard ? '2px solid var(--primary)' : '1px solid #ddd', background: !isCard ? 'var(--primary-light, #eef2ff)' : 'white', cursor: 'pointer' }}>טקסט חופשי</button>
                <button type="button" onClick={() => setIsCard(true)} style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: isCard ? '2px solid var(--primary)' : '1px solid #ddd', background: isCard ? 'var(--primary-light, #eef2ff)' : 'white', cursor: 'pointer' }}>כרטיסיה מודגשת</button>
              </div>
            </div>

            {/* Sticker / Ornament Selection */}
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>עיטורים (מדבקות):</span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '1.5rem' }}>
                {['', '❤️', '💖', '💝', '🌺', '🌻', '🌸', '✨', '⭐', '🌟', '🎈', '🎉', '🎊', '🎀', '🎁', '🎂', '🥂', '🕊️', '🦋', '🍀', '🏆', '👑', '💎', '🚀', '🌈'].map(emoji => (
                  <button 
                    key={emoji || 'none'} 
                    type="button" 
                    onClick={() => setStickerId(emoji || undefined)} 
                    style={{ minWidth: '40px', padding: emoji ? 0 : '0 1rem', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: stickerId === emoji || (!stickerId && !emoji) ? '2px solid var(--primary)' : '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: emoji ? '1.5rem' : '0.9rem', fontWeight: emoji ? 'normal' : 'bold' }}
                    title={emoji ? emoji : 'ללא עיטור'}
                  >
                    {emoji || 'ללא עיטור'}
                  </button>
                ))}
              </div>
            </div>

            {stickerId && (
              <div>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>מיקום העיטור בברכה:</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[
                    { id: 'top-right', label: 'ימין למעלה' },
                    { id: 'top-left', label: 'שמאל למעלה' },
                    { id: 'bottom-right', label: 'ימין למטה' },
                    { id: 'bottom-left', label: 'שמאל למטה' }
                  ].map(pos => (
                    <button 
                      key={pos.id} 
                      type="button" 
                      onClick={() => setStickerPosition(pos.id)} 
                      style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: stickerPosition === pos.id ? '2px solid var(--primary)' : '1px solid #ddd', background: stickerPosition === pos.id ? 'var(--primary-light, #eef2ff)' : 'white', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button type="submit" style={{ flex: 1, background: 'var(--primary)', color: 'white', border: 'none', padding: '1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>{initialData ? 'שמור שינויים' : 'פרסם ברכה'}</button>
          <button type="button" onClick={onCancel} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-light)', padding: '1rem', borderRadius: '8px', cursor: 'pointer' }}>ביטול</button>
        </div>
      </form>
    </div>
  );
}

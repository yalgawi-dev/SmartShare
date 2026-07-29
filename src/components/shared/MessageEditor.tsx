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
}

interface MessageEditorProps {
  initialData?: MessageData | null;
  onSave: (data: MessageData) => void;
  onCancel: () => void;
  title?: string;
  allowVideo?: boolean;
}

const FONT_OPTIONS = [
  { name: 'רגיל', value: 'Heebo' },
  { name: 'כתב יד', value: 'Amatic SC' },
  { name: 'קלאסי', value: 'Frank Ruhl Libre' },
  { name: 'עבה', value: 'Secular One' },
  { name: 'מודרני', value: 'Rubik' },
];

const BG_COLORS = [
  { name: 'לבן', value: 'white' },
  { name: 'צהוב', value: '#fef3c7' },
  { name: 'ורוד', value: '#fce7f3' },
  { name: 'תכלת', value: '#e0f2fe' },
  { name: 'ירוק', value: '#dcfce7' },
];

export default function MessageEditor({ initialData, onSave, onCancel, title = 'כתוב ברכה', allowVideo = false }: MessageEditorProps) {
  const [content, setContent] = useState(initialData?.content || '');
  const [selectedFont, setSelectedFont] = useState(initialData?.fontFamily || 'Heebo');
  const [selectedBgColor, setSelectedBgColor] = useState(initialData?.backgroundColor || 'white');
  
  const [attachedPhotoPreview, setAttachedPhotoPreview] = useState<string | null>(initialData?.attachedPhotoUrl || null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(initialData?.signatureUrl || null);
  const [videoPreview, setVideoPreview] = useState<string | null>(initialData?.videoUrl || null);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !attachedPhotoPreview && !signatureUrl && !videoPreview) return;
    
    onSave({
      id: initialData?.id,
      content,
      fontFamily: selectedFont,
      backgroundColor: selectedBgColor,
      attachedPhotoUrl: attachedPhotoPreview || undefined,
      signatureUrl: signatureUrl || undefined,
      videoUrl: videoPreview || undefined
    });
  };

  return (
    <div style={{ background: 'white', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem', border: '1px solid var(--border-light)', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          
          <div style={{ flex: 1, minWidth: '250px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="כתוב את הברכה שלך כאן..." 
              style={{ padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)', minHeight: '120px', resize: 'vertical', fontFamily: selectedFont, fontSize: '1.1rem', background: selectedBgColor }}
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
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>סגנון כתב:</span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {FONT_OPTIONS.map(font => (
                  <button key={font.value} type="button" onClick={() => setSelectedFont(font.value)} style={{ fontFamily: font.value, padding: '0.2rem 0.5rem', borderRadius: '20px', border: selectedFont === font.value ? '2px solid var(--primary)' : '1px solid var(--border-light)', background: selectedFont === font.value ? 'var(--primary)' : 'white', color: selectedFont === font.value ? 'white' : 'black', cursor: 'pointer' }}>{font.name}</button>
                ))}
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

'use client';
import React, { useEffect, useState, useRef } from 'react';

// Declare global pdfjsLib to avoid TS errors
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

interface PdfThumbnailProps {
  base64Uri?: string;
  url?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export default function PdfThumbnail({ base64Uri, url, style, onClick }: PdfThumbnailProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [error, setError] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetPdf = url || base64Uri;

  useEffect(() => {
    let isMounted = true;
    if (!targetPdf) return;
    
    const renderPdf = async () => {
      try {
        if (!window.pdfjsLib) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
              if (window.pdfjsLib) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve(null);
              } else {
                reject(new Error('pdfjsLib not found on window'));
              }
            };
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        let bytes: Uint8Array;
        if (targetPdf.startsWith('data:')) {
          const base64Data = targetPdf.includes('base64,') ? targetPdf.split('base64,')[1] : targetPdf;
          const binaryString = window.atob(base64Data);
          bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
        } else {
          const res = await fetch(targetPdf);
          const arrayBuffer = await res.arrayBuffer();
          bytes = new Uint8Array(arrayBuffer);
        }

        const loadingTask = window.pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        // Render at a decent resolution for preview
        const viewport = page.getViewport({ scale: 1.5 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('No 2d context');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        
        if (isMounted) {
          try {
            setImgSrc(canvas.toDataURL('image/webp', 0.8));
          } catch {
            setImgSrc(canvas.toDataURL('image/jpeg', 0.8));
          }
        }
      } catch (err) {
        console.error('Failed to render PDF thumbnail:', err);
        if (isMounted) setError(true);
      }
    };

    renderPdf();

    return () => {
      isMounted = false;
    };
  }, [targetPdf]);

  if (error || !imgSrc) {
    // Fallback UI if it's loading or failed
    return (
      <div 
        onClick={onClick}
        style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
          backgroundColor: '#e2e8f0', cursor: onClick ? 'zoom-in' : 'default', ...style 
        }}
      >
        <span style={{ fontSize: imgSrc === null ? '2rem' : '3rem', animation: imgSrc === null ? 'pulse 1.5s infinite' : 'none' }}>
          {imgSrc === null ? '⏳' : '📄'}
        </span>
        <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 'bold', marginTop: '4px' }}>
          {imgSrc === null ? 'מעבד...' : 'PDF'}
        </span>
      </div>
    );
  }

  return (
    <img 
      src={imgSrc} 
      alt="PDF Preview" 
      onClick={onClick}
      style={{ ...style, cursor: onClick ? 'zoom-in' : 'default' }}
    />
  );
}

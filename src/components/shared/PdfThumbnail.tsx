'use client';
import React, { useEffect, useState, useRef } from 'react';

// Declare global pdfjsLib to avoid TS errors
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

interface PdfThumbnailProps {
  base64Uri: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export default function PdfThumbnail({ base64Uri, style, onClick }: PdfThumbnailProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [error, setError] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let isMounted = true;
    
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

        const base64Data = base64Uri.includes('base64,') ? base64Uri.split('base64,')[1] : base64Uri;
        const binaryString = window.atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
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
          setImgSrc(canvas.toDataURL('image/jpeg', 0.8));
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
  }, [base64Uri]);

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

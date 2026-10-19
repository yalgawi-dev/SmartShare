import React, { useState, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { convertPdfToOptimizedImage } from '@/utils/imageOptimizer';
import { getDocumentPreviewUrl } from '@/utils/documentUtils';

interface DynamicPdfScrollPreviewProps {
  url: string;
  title?: string;
  initialThumbnail?: string;
}

/**
 * DynamicPdfScrollPreview - Single Source of Truth for on-the-fly PDF Megilah rendering
 * Renders all pages of a PDF into a single continuous scroll image in client memory (0 bytes cloud storage).
 */
export default function DynamicPdfScrollPreview({ url, title, initialThumbnail }: DynamicPdfScrollPreviewProps) {
  const [scrollImg, setScrollImg] = useState<string | null>(initialThumbnail || null);
  const [isLoading, setIsLoading] = useState<boolean>(!initialThumbnail);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (initialThumbnail && !initialThumbnail.includes('.pdf')) {
      setScrollImg(initialThumbnail);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(false);

    convertPdfToOptimizedImage(url, 1200, 0.82)
      .then((imgData) => {
        if (!isMounted) return;
        if (imgData && imgData !== url && !imgData.includes('.pdf')) {
          setScrollImg(imgData);
        } else {
          setError(true);
        }
      })
      .catch((err) => {
        console.error('Error rendering dynamic PDF scroll', err);
        if (isMounted) setError(true);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [url, initialThumbnail]);

  if (isLoading) {
    return (
      <div style={{ width: '100%', height: '78vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: '#38bdf8' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>טוען ומעבד את דפי המגילה...</span>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>פענוח בזיכרון המכשיר ללא תוספת שטח אחסון</span>
      </div>
    );
  }

  if (scrollImg) {
    return (
      <div style={{ width: '100%', height: '78vh', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none' }}>
        <TransformWrapper initialScale={1} minScale={0.8} maxScale={5} centerOnInit={true} wheel={{ step: 0.2 }}>
          <TransformComponent wrapperStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} contentStyle={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <img 
              src={scrollImg} 
              style={{ width: '100%', maxWidth: '650px', height: 'auto', maxHeight: 'none', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', userSelect: 'none' }} 
              alt={title || 'Preview'} 
            />
          </TransformComponent>
        </TransformWrapper>
      </div>
    );
  }

  // Fallback if client-side render fails (e.g. CORS block on external PDF)
  return (
    <div style={{ width: '100%', height: '78vh', position: 'relative', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', background: '#1e293b' }}>
      <iframe 
        src={getDocumentPreviewUrl(url)} 
        style={{ width: '100%', height: '100%', border: 'none' }} 
        title={title || 'PDF Document'} 
      />
    </div>
  );
}

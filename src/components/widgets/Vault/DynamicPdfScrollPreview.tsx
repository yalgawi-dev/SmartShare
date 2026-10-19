import React, { useState, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { extractPdfPages } from '@/utils/imageOptimizer';
import { getDocumentPreviewUrl } from '@/utils/documentUtils';

interface DynamicPdfScrollPreviewProps {
  url: string;
  title?: string;
  onPagesLoaded?: (pages: string[]) => void;
}

/**
 * DynamicPdfScrollPreview - Single Source of Truth for on-the-fly PDF Page rendering
 * Extracts each page into memory, displaying exactly ONE page at a time with pinch-to-zoom
 * and clean navigation (‹ עמוד 1 מתוך 2 ›) across pages.
 */
export default function DynamicPdfScrollPreview({ url, title, onPagesLoaded }: DynamicPdfScrollPreviewProps) {
  const [pages, setPages] = useState<string[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(false);
    setCurrentPageIndex(0);

    extractPdfPages(url, 1500, 0.85)
      .then((extracted) => {
        if (!isMounted) return;
        if (extracted && extracted.length > 0) {
          setPages(extracted);
          if (onPagesLoaded) {
            onPagesLoaded(extracted);
          }
        } else {
          setError(true);
        }
      })
      .catch((err) => {
        console.error('Error extracting PDF pages:', err);
        if (isMounted) setError(true);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [url]);

  if (isLoading) {
    return (
      <div style={{ width: '100%', height: '78vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: '#38bdf8' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>מזהה ומעבד את דפי המסמך...</span>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>טעינת דפים בזיכרון המכשיר</span>
      </div>
    );
  }

  if (pages.length > 0) {
    const currentImg = pages[currentPageIndex];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', position: 'relative' }}>
        {/* Navigation arrows for pages */}
        {currentPageIndex > 0 && (
          <button 
            onClick={(e) => { e.stopPropagation(); setCurrentPageIndex(p => p - 1); }}
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(15,23,42,0.75)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: '44px', height: '44px', fontSize: '1.6rem', cursor: 'pointer', zIndex: 200010, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
            title="עמוד קודם"
          >
            ‹
          </button>
        )}

        {currentPageIndex < pages.length - 1 && (
          <button 
            onClick={(e) => { e.stopPropagation(); setCurrentPageIndex(p => p + 1); }}
            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(15,23,42,0.75)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: '44px', height: '44px', fontSize: '1.6rem', cursor: 'pointer', zIndex: 200010, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
            title="עמוד הבא"
          >
            ›
          </button>
        )}

        {/* Single Page View with Pinch-to-Zoom */}
        <div style={{ width: '100%', height: '74vh', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none' }}>
          <TransformWrapper key={currentPageIndex} initialScale={1} minScale={0.8} maxScale={5} centerOnInit={true} wheel={{ step: 0.2 }}>
            <TransformComponent wrapperStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} contentStyle={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img 
                src={currentImg} 
                style={{ maxWidth: '100%', maxHeight: '74vh', width: 'auto', height: 'auto', borderRadius: '8px', boxShadow: '0 8px 30px rgba(0,0,0,0.6)', userSelect: 'none' }} 
                alt={title || 'Page'}
              />
            </TransformComponent>
          </TransformWrapper>
        </div>

        {/* Page indicator pill */}
        {pages.length > 1 && (
          <div style={{ marginTop: '0.4rem', color: '#f8fafc', background: 'rgba(30, 41, 59, 0.85)', backdropFilter: 'blur(4px)', padding: '4px 14px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.15)', zIndex: 200010 }}>
            עמוד {currentPageIndex + 1} מתוך {pages.length}
          </div>
        )}
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

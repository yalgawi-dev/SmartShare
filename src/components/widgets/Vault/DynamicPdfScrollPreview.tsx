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
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <TransformWrapper
          initialScale={1}
          minScale={0.7}
          maxScale={5}
          centerOnInit={true}
          doubleClick={{ mode: 'reset' }}
          wheel={{ step: 0.2 }}
        >
          <TransformComponent
            wrapperStyle={{ width: '100%', height: '100%', overflowY: 'auto' }}
            contentStyle={{ width: '100%', minHeight: '100%', display: 'flex', justifyContent: 'center' }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                padding: '1.5rem 1rem',
                maxWidth: '900px',
                width: '100%'
              }}
            >
              {pages.map((pageUrl: string, pageIdx: number) => (
                <div
                  key={pageIdx}
                  style={{
                    position: 'relative',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center'
                  }}
                >
                  <img
                    src={pageUrl}
                    alt={`עמוד ${pageIdx + 1}`}
                    loading="eager"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '76vh',
                      width: 'auto',
                      height: 'auto',
                      borderRadius: '10px',
                      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.65)',
                      userSelect: 'none',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  />
                  {pages.length > 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '12px',
                        right: '16px',
                        background: 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(6px)',
                        color: '#f8fafc',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                        zIndex: 10
                      }}
                    >
                      עמוד {pageIdx + 1} מתוך {pages.length}
                    </div>
                  )}
                </div>
              ))}
            </div>
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

import React, { useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

interface MultiPageViewerProps {
  pages: string[];
  title?: string;
}

/**
 * MultiPageViewer - Single Source of Truth for viewing multi-page documents
 * Displays exactly ONE page at a time with full pinch-to-zoom and clean navigation between pages.
 */
export default function MultiPageViewer({ pages, title }: MultiPageViewerProps) {
  const [currentPage, setCurrentPage] = useState<number>(0);

  if (!pages || pages.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', position: 'relative' }}>
      {/* Navigation arrows */}
      {currentPage > 0 && (
        <button 
          onClick={(e) => { e.stopPropagation(); setCurrentPage(p => p - 1); }}
          style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(15,23,42,0.75)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: '44px', height: '44px', fontSize: '1.6rem', cursor: 'pointer', zIndex: 200010, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
          title="עמוד קודם"
        >
          ‹
        </button>
      )}

      {currentPage < pages.length - 1 && (
        <button 
          onClick={(e) => { e.stopPropagation(); setCurrentPage(p => p + 1); }}
          style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(15,23,42,0.75)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: '44px', height: '44px', fontSize: '1.6rem', cursor: 'pointer', zIndex: 200010, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
          title="עמוד הבא"
        >
          ›
        </button>
      )}

      {/* Single Page View with Pinch-to-Zoom */}
      <div style={{ width: '100%', height: '74vh', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none' }}>
        <TransformWrapper key={currentPage} initialScale={1} minScale={0.8} maxScale={5} centerOnInit={true} wheel={{ step: 0.2 }}>
          <TransformComponent wrapperStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} contentStyle={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img 
              src={pages[currentPage]} 
              style={{ maxWidth: '100%', maxHeight: '74vh', width: 'auto', height: 'auto', borderRadius: '8px', boxShadow: '0 8px 30px rgba(0,0,0,0.6)', userSelect: 'none' }} 
              alt={title || 'Page'}
            />
          </TransformComponent>
        </TransformWrapper>
      </div>

      {/* Page indicator pill */}
      {pages.length > 1 && (
        <div style={{ marginTop: '0.4rem', color: '#f8fafc', background: 'rgba(30, 41, 59, 0.85)', backdropFilter: 'blur(4px)', padding: '4px 14px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.15)', zIndex: 200010 }}>
          עמוד {currentPage + 1} מתוך {pages.length}
        </div>
      )}
    </div>
  );
}

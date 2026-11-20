'use client';
import React, { useState, useEffect, useRef } from 'react';
import { getCachedPdfBytes, setCachedPdfBytes } from '@/utils/imageOptimizer';
import 'dwf-viewer/styles.css';

interface CadDocumentViewerProps {
  url: string;
  filename?: string;
}

/**
 * CadDocumentViewer - Lazy-loaded client-side CAD engine for DWG, DXF, DWF & DWFx.
 * 100% Free, Zero-Server, runs via WebAssembly and HTML5 Canvas / WebGL.
 * Features IndexedDB binary caching for instant re-opening without re-downloading.
 */
export default function CadDocumentViewer({ url, filename = 'drawing.dwg' }: CadDocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeLayers, setActiveLayers] = useState<{ name: string; visible: boolean; color?: string }[]>([]);
  const [showLayerDrawer, setShowLayerDrawer] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pan' | 'measure' | 'select'>('pan');
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const viewerRef = useRef<any>(null);

  const lowerName = filename.toLowerCase();
  const isDwf = lowerName.endsWith('.dwf') || lowerName.endsWith('.dwfx');

  useEffect(() => {
    let isCancelled = false;

    const loadAndRender = async () => {
      try {
        setIsLoading(true);
        setErrorMsg(null);

        // 1. Try to load CAD file bytes from IndexedDB cache first
        let buffer: ArrayBuffer | null = null;
        try {
          const cachedBytes = await getCachedPdfBytes(url);
          if (cachedBytes && cachedBytes.length > 0) {
            const rawBuffer = cachedBytes.buffer.slice(
              cachedBytes.byteOffset,
              cachedBytes.byteOffset + cachedBytes.byteLength
            );
            buffer = rawBuffer instanceof ArrayBuffer ? rawBuffer : new Uint8Array(cachedBytes).buffer as ArrayBuffer;
          }
        } catch (e) {
          console.warn('[CadDocumentViewer] Cache read error, falling back to network:', e);
        }

        // 2. Fetch from network if not cached
        if (!buffer) {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`שגיאה בהורדת קובץ השרטוט (${res.status})`);
          buffer = await res.arrayBuffer();

          // Save to IndexedDB cache in background
          try {
            await setCachedPdfBytes(url, new Uint8Array(buffer));
          } catch (e) {
            console.warn('[CadDocumentViewer] Failed to cache CAD bytes:', e);
          }
        }

        if (isCancelled) return;

        if (isDwf) {
          // Render DWF / DWFx via dwf-viewer
          const { DwfViewer } = await import('dwf-viewer');
          if (isCancelled || !containerRef.current) return;

          containerRef.current.innerHTML = '';
          const dwfViewer = new DwfViewer(containerRef.current, {
            background: theme === 'dark' ? '#0f172a' : '#ffffff',
            preferWebgl: true,
            preferWasm: false,
            lineWeightMode: 'adaptive'
          });

          await dwfViewer.load(buffer, { fileName: filename });
          viewerRef.current = dwfViewer;

          // Attach mobile touch pinch-to-zoom & two-finger pan handlers to the overlay canvas
          const overlayCanvas = containerRef.current.querySelector<HTMLCanvasElement>('.dwfv-overlay-canvas');
          if (overlayCanvas) {
            let initialDist = 0;
            let lastTouchX = 0;
            let lastTouchY = 0;

            const getTouchDistance = (t1: Touch, t2: Touch) => {
              const dx = t1.clientX - t2.clientX;
              const dy = t1.clientY - t2.clientY;
              return Math.hypot(dx, dy);
            };

            const onTouchStart = (e: TouchEvent) => {
              if (e.touches.length === 2) {
                e.preventDefault();
                initialDist = getTouchDistance(e.touches[0], e.touches[1]);
                lastTouchX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                lastTouchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
              }
            };

            const onTouchMove = (e: TouchEvent) => {
              if (e.touches.length === 2 && initialDist > 0) {
                e.preventDefault();
                const newDist = getTouchDistance(e.touches[0], e.touches[1]);
                const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                const factor = newDist / initialDist;

                if (Math.abs(factor - 1) > 0.02) {
                  const rect = overlayCanvas.getBoundingClientRect();
                  const dpr = (dwfViewer as any).currentDpr || window.devicePixelRatio || 1;
                  const cx = (midX - rect.left) * dpr;
                  const cy = (midY - rect.top) * dpr;
                  if ((dwfViewer as any).zoomAroundPoint) {
                    (dwfViewer as any).zoomAroundPoint(factor, cx, cy);
                  } else if ((dwfViewer as any).zoomAtCenter) {
                    (dwfViewer as any).zoomAtCenter(factor);
                  }
                  initialDist = newDist;
                }

                const dx = (midX - lastTouchX) * ((dwfViewer as any).currentDpr || 1);
                const dy = (midY - lastTouchY) * ((dwfViewer as any).currentDpr || 1);
                if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                  (dwfViewer as any).panX = ((dwfViewer as any).panX || 0) + dx;
                  (dwfViewer as any).panY = ((dwfViewer as any).panY || 0) + dy;
                  lastTouchX = midX;
                  lastTouchY = midY;
                }

                (dwfViewer as any).requestRender?.();
              }
            };

            const onTouchEnd = () => {
              initialDist = 0;
            };

            overlayCanvas.addEventListener('touchstart', onTouchStart, { passive: false });
            overlayCanvas.addEventListener('touchmove', onTouchMove, { passive: false });
            overlayCanvas.addEventListener('touchend', onTouchEnd);
          }

          // Request fit after DOM layout settles to prevent blank canvas
          setTimeout(() => {
            if (!isCancelled && viewerRef.current?.fit) {
              try {
                viewerRef.current.fit();
              } catch {}
            }
          }, 100);

          setIsLoading(false);
        } else {
          // Render DWG / DXF via @cadview/core + @cadview/dwg
          const { CadViewer } = await import('@cadview/core');
          const { dwgConverter } = await import('@cadview/dwg');

          if (isCancelled || !containerRef.current) return;

          containerRef.current.innerHTML = '';
          const canvas = document.createElement('canvas');
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          canvas.style.display = 'block';
          containerRef.current.appendChild(canvas);

          const viewer = new CadViewer(canvas, {
            theme: theme === 'dark' ? 'dark' : 'light',
            formatConverters: [dwgConverter]
          });

          await viewer.loadBuffer(buffer);
          viewerRef.current = viewer;

          const layers = viewer.getLayers ? viewer.getLayers() : [];
          setActiveLayers(layers.map((l: any) => ({ name: l.name, visible: l.visible !== false, color: l.color })));

          viewer.fitToView();
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('[CadDocumentViewer] Error loading CAD drawing:', err);
        if (!isCancelled) {
          setErrorMsg(err?.message || 'לא ניתן לפענח שרטוט זה בדפדפן');
          setIsLoading(false);
        }
      }
    };

    loadAndRender();

    return () => {
      isCancelled = true;
      if (viewerRef.current?.dispose) {
        try {
          viewerRef.current.dispose();
        } catch {}
      } else if (viewerRef.current?.destroy) {
        try {
          viewerRef.current.destroy();
        } catch {}
      }
      viewerRef.current = null;
    };
  }, [url, filename, isDwf]);

  const toggleLayer = (layerName: string) => {
    setActiveLayers(prev =>
      prev.map(l => {
        if (l.name === layerName) {
          const nextVis = !l.visible;
          if (viewerRef.current?.setLayerVisible) {
            viewerRef.current.setLayerVisible(layerName, nextVis);
          }
          return { ...l, visible: nextVis };
        }
        return l;
      })
    );
  };

  const handleFit = () => {
    if (viewerRef.current?.fitToView) {
      viewerRef.current.fitToView();
    } else if (viewerRef.current?.fit) {
      viewerRef.current.fit();
    }
  };

  const handleZoom = (factor: number) => {
    if (viewerRef.current?.zoomAtCenter) {
      viewerRef.current.zoomAtCenter(factor);
      viewerRef.current.requestRender?.();
    } else if (viewerRef.current?.handleZoom) {
      const canvas = containerRef.current?.querySelector('canvas');
      const w = canvas ? canvas.width : window.innerWidth;
      const h = canvas ? canvas.height : window.innerHeight;
      viewerRef.current.handleZoom(w / 2, h / 2, factor);
    }
  };

  const handleToolChange = (tool: 'pan' | 'measure' | 'select') => {
    setCurrentTool(tool);
    if (viewerRef.current?.setTool) {
      viewerRef.current.setTool(tool);
    }
  };

  const handleThemeToggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (viewerRef.current?.setTheme) {
      viewerRef.current.setTheme(next);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: theme === 'dark' ? '#0f172a' : '#f8fafc', overflow: 'hidden' }}>
      {/* Scoped CSS for DWF/DWFx full container fit and clean toolbar styling */}
      <style jsx global>{`
        .dwfv-root {
          height: 100% !important;
          width: 100% !important;
          background: transparent !important;
          display: flex !important;
          flex-direction: column !important;
        }
        .dwfv-toolbar {
          display: none !important;
        }
        .dwfv-workspace {
          flex: 1 1 auto !important;
          height: 100% !important;
          min-height: 0 !important;
        }
        .dwfv-stage {
          position: relative !important;
          width: 100% !important;
          height: 100% !important;
          background: #f1f5f9 !important;
        }
        .dwfv-canvas {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>

      {/* CAD Canvas / View Container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }} />

      {/* Floating Toolbar Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          padding: '6px 12px',
          borderRadius: '16px',
          zIndex: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          direction: 'ltr'
        }}
      >
        <button
          type="button"
          onClick={() => handleZoom(1.3)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            padding: '6px 10px',
            borderRadius: '8px',
            fontSize: '0.95rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="הגדל (Zoom In)"
        >
          <span>➕</span>
        </button>

        <button
          type="button"
          onClick={() => handleZoom(0.77)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            padding: '6px 10px',
            borderRadius: '8px',
            fontSize: '0.95rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="הקטן (Zoom Out)"
        >
          <span>➖</span>
        </button>

        <button
          type="button"
          onClick={handleFit}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            padding: '6px 10px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title="התאם למסך (Fit to View)"
        >
          <span>⤢</span>
          <span>מרכז</span>
        </button>

        <button
          type="button"
          onClick={() => handleToolChange('pan')}
          style={{
            background: currentTool === 'pan' ? '#2563eb' : 'transparent',
            border: 'none',
            color: 'white',
            padding: '6px 10px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title="גרירה (Pan)"
        >
          <span>✋</span>
        </button>

        <button
          type="button"
          onClick={() => handleToolChange('measure')}
          style={{
            background: currentTool === 'measure' ? '#2563eb' : 'transparent',
            border: 'none',
            color: 'white',
            padding: '6px 10px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title="כלי מדידה (Measure)"
        >
          <span>📏</span>
        </button>

        {activeLayers.length > 0 && (
          <button
            type="button"
            onClick={() => setShowLayerDrawer(prev => !prev)}
            style={{
              background: showLayerDrawer ? '#4f46e5' : 'transparent',
              border: 'none',
              color: 'white',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="שכבות שרטוט"
          >
            <span>📑</span>
            <span>שכבות ({activeLayers.length})</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleThemeToggle}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            padding: '6px 10px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            cursor: 'pointer'
          }}
          title="החלף רקע (כהה / בהיר)"
        >
          <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
        </button>
      </div>

      {/* Layers Side Drawer */}
      {showLayerDrawer && activeLayers.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '70px',
            right: '16px',
            maxHeight: 'calc(100% - 160px)',
            width: '240px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '12px',
            zIndex: 30,
            overflowY: 'auto',
            color: 'white',
            direction: 'rtl',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>שכבות שרטוט</span>
            <button type="button" onClick={() => setShowLayerDrawer(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {activeLayers.map(l => (
              <label
                key={l.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.78rem',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: l.visible ? 'rgba(255,255,255,0.05)' : 'transparent',
                  color: l.visible ? '#ffffff' : '#64748b'
                }}
              >
                <input
                  type="checkbox"
                  checked={l.visible}
                  onChange={() => toggleLayer(l.name)}
                  style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{l.name}</span>
                {l.color && (
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color, border: '1px solid #ffffff' }} />
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            zIndex: 40,
            gap: '12px'
          }}
        >
          <div style={{ fontSize: '2.5rem', animation: 'spin 1.5s linear infinite' }}>📐</div>
          <div style={{ fontSize: '1rem', fontWeight: 800 }}>מפענח שרטוט הנדסי...</div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>טוען מנוע CAD מקומי ללא שרת (100% חינם)</div>
        </div>
      )}

      {/* Error Fallback */}
      {errorMsg && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            zIndex: 45,
            padding: '2rem',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 800 }}>לא ניתן לפתוח את השרטוט</h3>
          <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.82rem', color: '#cbd5e1', maxWidth: '320px', lineHeight: 1.5 }}>
            {errorMsg}
          </p>
          <a
            href={url}
            download={filename}
            style={{
              background: '#2563eb',
              color: 'white',
              padding: '0.65rem 1.25rem',
              borderRadius: '12px',
              textDecoration: 'none',
              fontWeight: 800,
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>💾</span> הורד שרטוט למכשיר
          </a>
        </div>
      )}
    </div>
  );
}

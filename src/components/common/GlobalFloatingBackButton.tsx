'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface HierarchyState {
  shelfId: string | null;
  folderId: string | null;
  parentFolderId: string | null;
}

export default function GlobalFloatingBackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [hierarchy, setHierarchy] = useState<HierarchyState>({
    shelfId: null,
    folderId: null,
    parentFolderId: null,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset hierarchy state when route changes
  useEffect(() => {
    setHierarchy({ shelfId: null, folderId: null, parentFolderId: null });
  }, [pathname]);

  useEffect(() => {
    const handleHierarchy = (e: any) => {
      if (e?.detail) {
        setHierarchy({
          shelfId: e.detail.shelfId || null,
          folderId: e.detail.folderId || null,
          parentFolderId: e.detail.parentFolderId || null,
        });
      }
    };

    const handleShelfOpened = (e: any) => {
      if (e?.detail?.shelfId) {
        setHierarchy(prev => ({ ...prev, shelfId: e.detail.shelfId }));
      }
    };

    const handleShelfClosed = () => {
      setHierarchy({ shelfId: null, folderId: null, parentFolderId: null });
    };

    const handlePreviewOpen = () => setIsPreviewOpen(true);
    const handlePreviewClose = () => setIsPreviewOpen(false);

    window.addEventListener('smartshare:hierarchy_state', handleHierarchy);
    window.addEventListener('smartshare:shelf_opened', handleShelfOpened);
    window.addEventListener('smartshare:shelf_closed', handleShelfClosed);
    window.addEventListener('smartshare:preview_open', handlePreviewOpen);
    window.addEventListener('smartshare:preview_closed', handlePreviewClose);

    return () => {
      window.removeEventListener('smartshare:hierarchy_state', handleHierarchy);
      window.removeEventListener('smartshare:shelf_opened', handleShelfOpened);
      window.removeEventListener('smartshare:shelf_closed', handleShelfClosed);
      window.removeEventListener('smartshare:preview_open', handlePreviewOpen);
      window.removeEventListener('smartshare:preview_closed', handlePreviewClose);
    };
  }, []);

  if (!mounted || isPreviewOpen) return null;

  // Hide on the root dashboard ('/'), on reports, and on admin control panel
  if (!pathname || pathname === '/' || pathname.includes('/reports') || pathname.startsWith('/admin')) return null;

  const isSpaceSubPage = /^\/space\/[^/]+\/(settings|reports|features)/.test(pathname);
  const isSpaceMainPage = /^\/space\/[^/]+$/.test(pathname) && pathname !== '/space/new';
  
  if (isSpaceMainPage) return null;

  const hasBottomBar = pathname === '/settings';

  const getStepBackLabel = (): string => {
    return 'חזרה';
  };

  const handleBackClick = () => {
    // 1. First let any active inner view (e.g. open folder, open shelf, open modal in Space) handle 1 step back
    const stepEvent = new CustomEvent('smartshare:navigate_back_one_step', {
      detail: { handled: false },
    });
    window.dispatchEvent(stepEvent);
    if ((stepEvent as any).detail?.handled) {
      return;
    }

    // 2. Otherwise navigate 1 page level up deterministically
    if (isSpaceSubPage) {
      const parts = pathname.split('/');
      const spaceId = parts[2];
      if (spaceId) {
        router.push(`/space/${spaceId}`);
        return;
      }
    }

    if (isSpaceMainPage) {
      if (typeof window !== 'undefined') {
        const fromParam = new URLSearchParams(window.location.search).get('from');
        if (fromParam === 'settings_active') {
          const spaceId = pathname.split('/')[2];
          router.push(`/settings?tab=spaces&sub=active&targetSpace=${spaceId}`);
          return;
        }
        if (fromParam === 'settings_archived') {
          const spaceId = pathname.split('/')[2];
          router.push(`/settings?tab=spaces&sub=archived&targetSpace=${spaceId}`);
          return;
        }
      }
      router.push('/');
      return;
    }

    // Default for /settings, /admin/users, /space/new, etc.
    router.push('/');
  };

  return (
    <button
      type="button"
      onClick={handleBackClick}
      title="חזור אחורה צעד אחד"
      style={{
        position: 'fixed',
        bottom: hasBottomBar ? '6.1rem' : '1.5rem',
        right: '1rem',
        zIndex: 9990,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        color: '#ffffff',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        borderRadius: '999px',
        padding: '0.5rem 0.95rem',
        fontSize: '0.84rem',
        fontWeight: 800,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        direction: 'rtl',
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: '1.05rem', lineHeight: 1, display: 'inline-block', transform: 'translateY(-1px)' }}>↩</span>
      <span>{getStepBackLabel()}</span>
    </button>
  );
}

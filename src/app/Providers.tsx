'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { SpacesProvider } from './context/SpacesContext';
import { AuthProvider } from './context/AuthContext';
import { AuthGuard } from './AuthGuard';
import { ChatProvider } from './context/ChatContext';
import { useTelemetryTracker } from '../hooks/useTelemetryTracker';

function GlobalTelemetryWatcher() {
  useTelemetryTracker();
  return null;
}

// Dynamically import SharedFileHandler so it never runs during SSR
const SharedFileHandler = dynamic(() => import('../components/widgets/SharedFileHandler'), { ssr: false });

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SpacesProvider>
        <ChatProvider>
          <AuthGuard>
            <SharedFileHandler />
            <GlobalTelemetryWatcher />
            {children}
          </AuthGuard>
        </ChatProvider>
      </SpacesProvider>
    </AuthProvider>
  );
}

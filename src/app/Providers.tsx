'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { SpacesProvider } from './context/SpacesContext';
import { AuthProvider } from './context/AuthContext';
import { AuthGuard } from './AuthGuard';
import { ChatProvider } from './context/ChatContext';
import { useTelemetryTracker } from '../hooks/useTelemetryTracker';
import { AssistantProvider } from '../components/common/AssistantEngine/AssistantContext';
import { GlobalAssistantDrawer } from '../components/common/AssistantEngine/GlobalAssistantDrawer';

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
          <AssistantProvider>
            <AuthGuard>
              <SharedFileHandler />
              <GlobalTelemetryWatcher />
              {children}
              <GlobalAssistantDrawer />
            </AuthGuard>
          </AssistantProvider>
        </ChatProvider>
      </SpacesProvider>
    </AuthProvider>
  );
}

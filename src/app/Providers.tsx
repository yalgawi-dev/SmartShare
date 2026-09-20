'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { SpacesProvider } from './context/SpacesContext';
import { AuthProvider } from './context/AuthContext';

// Dynamically import SharedFileHandler so it never runs during SSR
const SharedFileHandler = dynamic(() => import('../components/widgets/SharedFileHandler'), { ssr: false });

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SpacesProvider>
        <SharedFileHandler />
        {children}
      </SpacesProvider>
    </AuthProvider>
  );
}

'use client';

import { ReactNode } from 'react';
import { SpacesProvider } from './context/SpacesContext';
import { AuthProvider } from './context/AuthContext';
import SharedFileHandler from '../components/widgets/SharedFileHandler';
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

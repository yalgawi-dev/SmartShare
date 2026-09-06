'use client';

import { ReactNode } from 'react';
import { SpacesProvider } from './context/SpacesContext';
import { AuthProvider } from './context/AuthContext';
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SpacesProvider>
        {children}
      </SpacesProvider>
    </AuthProvider>
  );
}

'use client';

import { ReactNode } from 'react';
import { SpacesProvider } from './context/SpacesContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SpacesProvider>
      {children}
    </SpacesProvider>
  );
}

'use client';

import { ReactNode } from 'react';
import { SpacesProvider } from './context/SpacesContext';
import { AuthProvider } from './context/AuthContext';
import RegistrationModal from '../components/auth/RegistrationModal';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
              <SpacesProvider>
          {children}
          <RegistrationModal />
        </SpacesProvider>
          </AuthProvider>
  );
}

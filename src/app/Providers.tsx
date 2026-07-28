'use client';

import { ReactNode } from 'react';
import { SpacesProvider } from './context/SpacesContext';
import { AuthProvider } from './context/AuthContext';
import { GuestProvider } from './context/GuestContext';
import RegistrationModal from '../components/auth/RegistrationModal';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <GuestProvider>
        <SpacesProvider>
          {children}
          <RegistrationModal />
        </SpacesProvider>
      </GuestProvider>
    </AuthProvider>
  );
}

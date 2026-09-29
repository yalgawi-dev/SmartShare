'use client';

import React from 'react';
import { useAuth } from './context/AuthContext';
import AuthWall from '../components/widgets/Auth/AuthWall';


export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useAuth();
  
  if (!isLoaded) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!user || !user.phone) {
    return <AuthWall />;
  }
  
  return <>{children}</>;
}

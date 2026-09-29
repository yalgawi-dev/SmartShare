'use client';

import React from 'react';
import { useAuth } from './context/AuthContext';
import AuthWall from '../components/widgets/Auth/AuthWall';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useAuth();
  
  if (!isLoaded) {
    return (
      <div className="auth-guard-loading">
        <div className="spinner"></div>
        <style>{`
          .auth-guard-loading {
            height: 100dvh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%);
          }
          .spinner {
            width: 40px; height: 40px;
            border: 4px solid var(--primary, #4F46E5);
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }
  
  if (!user || !user.phone || !user.realName) {
    return <AuthWall />;
  }
  
  return <>{children}</>;
}

'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type ChatTarget = 'group' | string | null;

interface ChatContextType {
  isOpen: boolean;
  activeTarget: ChatTarget;
  openChat: (target: ChatTarget) => void;
  closeChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTarget, setActiveTarget] = useState<ChatTarget>(null);

  const openChat = (target: ChatTarget) => {
    setActiveTarget(target);
    setIsOpen(true);
  };

  const closeChat = () => {
    setIsOpen(false);
    setActiveTarget(null);
  };

  return (
    <ChatContext.Provider value={{ isOpen, activeTarget, openChat, closeChat }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

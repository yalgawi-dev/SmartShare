'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ScreenContext, getContextSuggestions } from './assistantKnowledge';
import { sanitizeAssistantQuery, filterAssistantResponse } from './assistantSecurity';
import { queryAIAssistant, AIProviderConfig } from './assistantProviderBridge';
import { logAssistantLearningEvent } from './assistantLearning';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  source?: 'local_brain' | 'cloud_llm';
  fallbackReason?: string;
  queryText?: string;
  nodeId?: string;
  confidence?: 'high' | 'medium' | 'low';
  followUps?: string[];
  feedback?: 'helpful' | 'not_helpful';
}

interface AssistantContextType {
  screenContext: ScreenContext;
  updateScreenContext: (updates: Partial<ScreenContext>) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<void>;
  submitFeedback: (messageId: string, rating: 'helpful' | 'not_helpful') => void;
  clearChat: () => void;
  suggestedQuestions: string[];
  isSpeaking: boolean;
  speakText: (text: string) => void;
  stopSpeaking: () => void;
  providerConfig: AIProviderConfig;
  setProviderConfig: (config: AIProviderConfig) => void;
}

const AssistantContext = createContext<AssistantContextType | undefined>(undefined);

export const AssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname() || '/';
  const [screenContext, setScreenContext] = useState<ScreenContext>({
    route: pathname,
    activeWidget: 'general',
    userRole: 'partner'
  });

  // Shadow the user automatically across every Next.js route transition
  useEffect(() => {
    setScreenContext(prev => {
      if (prev.route === pathname) return prev;
      return {
        ...prev,
        route: pathname,
        activeModal: null,
        currentFolderId: pathname.startsWith('/space/') ? prev.currentFolderId : null,
        currentFolderName: pathname.startsWith('/space/') ? prev.currentFolderName : undefined,
        activeWidget: pathname.startsWith('/space/') ? prev.activeWidget : 'general'
      };
    });
  }, [pathname]);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'שלום! אני הסוכן האישי שלך. אני מלווה אותך בכל דף, מזהה היכן אתה נמצא ויכול להסביר לך הכל בדיבור או בכתב. במה אוכל לעזור?',
      timestamp: Date.now()
    }
  ]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [providerConfig, setProviderConfig] = useState<AIProviderConfig>({
    provider: 'cloud_llm',
    isPremiumEnabled: true
  });

  const updateScreenContext = useCallback((updates: Partial<ScreenContext>) => {
    setScreenContext(prev => ({ ...prev, ...updates }));
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const clearChat = useCallback(() => {
    setMessages([
      {
        id: `msg_${Date.now()}`,
        sender: 'assistant',
        text: 'השיחה אופסה. אני לרשותך לכל שאלה!',
        timestamp: Date.now()
      }
    ]);
  }, []);

  // Voice Text-to-Speech (Hebrew)
  const speakText = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'he-IL';
      utterance.rate = 1.0;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch (_) {
      setIsSpeaking(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  // Send message with security validation
  const sendMessage = useCallback(async (text: string) => {
    const { safe, sanitizedText, reason } = sanitizeAssistantQuery(text);

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: sanitizedText || text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);

    if (!safe) {
      const blockedMsg: ChatMessage = {
        id: `ast_${Date.now()}`,
        sender: 'assistant',
        text: reason || 'פעולה זו אינה מורשית מטעמי אבטחה.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, blockedMsg]);
      return;
    }

    // Process answer from assistant brain (Bridge: Free Local vs Premium Cloud)
    const aiResult = await queryAIAssistant(sanitizedText, screenContext, providerConfig);
    const scrubbedAnswer = filterAssistantResponse(aiResult.text);

    if (aiResult.confidence === 'low') {
      logAssistantLearningEvent(
        { type: 'unresolved', queryText: sanitizedText, confidence: 'low' },
        screenContext
      );
    }

    const assistantMsg: ChatMessage = {
      id: `ast_${Date.now()}`,
      sender: 'assistant',
      text: scrubbedAnswer,
      timestamp: Date.now(),
      source: aiResult.source,
      fallbackReason: aiResult.fallbackReason,
      queryText: sanitizedText,
      nodeId: aiResult.nodeId,
      confidence: aiResult.confidence,
      followUps: aiResult.suggestions?.map(s => s.sampleQuestion).filter(Boolean).slice(0, 3)
    };

    setMessages(prev => [...prev, assistantMsg]);
  }, [screenContext, providerConfig]);

  const submitFeedback = useCallback((messageId: string, rating: 'helpful' | 'not_helpful') => {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId || m.feedback) return m;
      logAssistantLearningEvent(
        {
          type: 'feedback',
          queryText: m.queryText || m.text.slice(0, 80),
          matchedNodeId: m.nodeId,
          confidence: m.confidence,
          rating
        },
        screenContext
      );
      return { ...m, feedback: rating };
    }));
  }, [screenContext]);

  const suggestedQuestions = useMemo(() => {
    return getContextSuggestions(screenContext);
  }, [screenContext]);

  return (
    <AssistantContext.Provider
      value={{
        screenContext,
        updateScreenContext,
        isOpen,
        setIsOpen,
        toggleOpen,
        messages,
        sendMessage,
        submitFeedback,
        clearChat,
        suggestedQuestions,
        isSpeaking,
        speakText,
        stopSpeaking,
        providerConfig,
        setProviderConfig
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
};

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return ctx;
}

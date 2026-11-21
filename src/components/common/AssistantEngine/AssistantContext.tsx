'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ScreenContext, getContextSuggestions } from './assistantKnowledge';
import { sanitizeAssistantQuery, filterAssistantResponse } from './assistantSecurity';
import { queryAIAssistant, AIProviderConfig } from './assistantProviderBridge';
import { logAssistantLearningEvent } from './assistantLearning';
import { buildLiveAssistantSnapshot } from './assistantSnapshot';
import { useAuth } from '@/app/context/AuthContext';
import { useSpaces } from '@/app/context/SpacesContext';

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
  isAudioLoading: boolean;
  autoSpeak: boolean;
  toggleAutoSpeak: () => void;
  speakText: (text: string) => void;
  stopSpeaking: () => void;
  providerConfig: AIProviderConfig;
  setProviderConfig: (config: AIProviderConfig) => void;
}

const AssistantContext = createContext<AssistantContextType | undefined>(undefined);

export const AssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname() || '/';
  const { user } = useAuth();
  const { spaces } = useSpaces();

  // Extract spaceId from pathname if on /space/[id]
  const matchedSpaceId = useMemo(() => {
    if (!pathname) return undefined;
    const match = pathname.match(/\/space\/([^/?#]+)/);
    return match ? match[1] : undefined;
  }, [pathname]);

  const currentSpace = useMemo(() => {
    if (!matchedSpaceId || !spaces) return undefined;
    return spaces.find(s => s.id === matchedSpaceId);
  }, [matchedSpaceId, spaces]);

  const [screenContext, setScreenContext] = useState<ScreenContext>(() => ({
    route: pathname,
    spaceId: matchedSpaceId,
    spaceTitle: currentSpace?.title,
    activeWidget: 'general',
    userRole: 'partner'
  }));

  // Shadow the user automatically across every Next.js route transition and space updates
  useEffect(() => {
    setScreenContext(prev => {
      const isSpaceRoute = pathname.startsWith('/space/');
      const spaceChanged = isSpaceRoute && matchedSpaceId !== prev.spaceId;
      const title = currentSpace?.title || (isSpaceRoute && matchedSpaceId === prev.spaceId ? prev.spaceTitle : undefined);

      if (prev.route === pathname && prev.spaceId === matchedSpaceId && prev.spaceTitle === title) {
        return prev;
      }

      return {
        ...prev,
        route: pathname,
        spaceId: isSpaceRoute ? matchedSpaceId : undefined,
        spaceTitle: title,
        activeModal: null,
        currentFolderId: isSpaceRoute && !spaceChanged ? prev.currentFolderId : null,
        currentFolderName: isSpaceRoute && !spaceChanged ? prev.currentFolderName : undefined,
        activeWidget: isSpaceRoute && !spaceChanged ? prev.activeWidget : 'general'
      };
    });
  }, [pathname, matchedSpaceId, currentSpace?.title]);

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
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('smartshare_assistant_autospeak') === 'true';
      } catch (_) {
        return false;
      }
    }
    return false;
  });

  const toggleAutoSpeak = useCallback(() => {
    setAutoSpeak(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('smartshare_assistant_autospeak', String(next));
        } catch (_) {}
      }
      return next;
    });
  }, []);

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

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = React.useRef<string | null>(null);
  const ttsAbortControllerRef = React.useRef<AbortController | null>(null);
  const audioCacheRef = React.useRef<Map<string, string>>(new Map());
  const activeSpeakSeqRef = React.useRef<number>(0);

  const stopSpeaking = useCallback(() => {
    // Abort pending fetch immediately
    if (ttsAbortControllerRef.current) {
      ttsAbortControllerRef.current.abort();
      ttsAbortControllerRef.current = null;
    }
    // Stop any currently playing audio immediately
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsAudioLoading(false);
  }, []);

  // Natural Human Hebrew TTS via Gemini Neural Voice (/api/assistant/tts) with singleton concurrency & client cache
  const speakText = useCallback(async (text: string) => {
    if (typeof window === 'undefined') return;

    // Immediately stop any prior speech or pending request (prevents double speech completely!)
    stopSpeaking();

    const cleanText = text
      .replace(/[*_`#]/g, '')
      .replace(/₪/g, ' שקלים ')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanText) return;

    // Monotonic counter to invalidate any outdated responses
    const seq = ++activeSpeakSeqRef.current;

    // Check client audio cache for instant playback (0ms latency!)
    const cachedUrl = audioCacheRef.current.get(cleanText);
    if (cachedUrl) {
      try {
        setIsSpeaking(true);
        const audio = new Audio(cachedUrl);
        audioRef.current = audio;
        audio.onended = () => {
          if (activeSpeakSeqRef.current === seq) stopSpeaking();
        };
        audio.onerror = () => {
          if (activeSpeakSeqRef.current === seq) stopSpeaking();
        };
        await audio.play();
        return;
      } catch (_) {
        // Fall back to refetch if cached URL became invalid
      }
    }

    setIsAudioLoading(true);

    // Setup dedicated AbortController
    const abortCtrl = new AbortController();
    ttsAbortControllerRef.current = abortCtrl;

    // 1. Try human-sounding Gemini Neural Hebrew TTS
    try {
      const res = await fetch('/api/assistant/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText }),
        signal: abortCtrl.signal
      });

      // If user triggered another speech in the meantime, ignore
      if (activeSpeakSeqRef.current !== seq) return;

      if (res.ok) {
        const blob = await res.blob();
        if (activeSpeakSeqRef.current !== seq) return;

        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        audioCacheRef.current.set(cleanText, url);

        setIsAudioLoading(false);
        setIsSpeaking(true);

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          if (activeSpeakSeqRef.current === seq) stopSpeaking();
        };
        audio.onerror = () => {
          if (activeSpeakSeqRef.current === seq) stopSpeaking();
        };
        await audio.play();
        return;
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || activeSpeakSeqRef.current !== seq) {
        return;
      }
      // Fall through cleanly to native Hebrew browser voice
    }

    if (activeSpeakSeqRef.current !== seq) return;
    setIsAudioLoading(false);

    // 2. Fallback: Web Speech API with explicit Hebrew voice selection
    if (!('speechSynthesis' in window)) {
      setIsSpeaking(false);
      return;
    }
    try {
      setIsSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'he-IL';
      utterance.rate = 1.0;
      const voices = window.speechSynthesis.getVoices() || [];
      const heVoice =
        voices.find(v => (v.lang === 'he-IL' || v.lang === 'iw-IL') && /google|carmit|hila|avri|natural/i.test(v.name)) ||
        voices.find(v => v.lang.toLowerCase().startsWith('he') || v.lang.toLowerCase().startsWith('iw'));
      if (heVoice) utterance.voice = heVoice;
      utterance.onend = () => {
        if (activeSpeakSeqRef.current === seq) setIsSpeaking(false);
      };
      utterance.onerror = () => {
        if (activeSpeakSeqRef.current === seq) setIsSpeaking(false);
      };
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
    }
  }, [stopSpeaking]);

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

    // Process answer from assistant brain (Bridge: Free Local vs Gemini Live AI)
    const liveData = buildLiveAssistantSnapshot(user, spaces);
    const aiResult = await queryAIAssistant(sanitizedText, screenContext, providerConfig, liveData);
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

    // Auto-Speak feature: immediately speak newly received assistant response if enabled
    if (autoSpeak && scrubbedAnswer) {
      speakText(scrubbedAnswer);
    }
  }, [screenContext, providerConfig, user, spaces, autoSpeak, speakText]);

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
        isAudioLoading,
        autoSpeak,
        toggleAutoSpeak,
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

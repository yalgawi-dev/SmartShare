'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ScreenContext, getContextSuggestions } from './assistantKnowledge';
import { sanitizeAssistantQuery, filterAssistantResponse } from './assistantSecurity';
import { queryAIAssistant, AIProviderConfig } from './assistantProviderBridge';
import { logAssistantLearningEvent } from './assistantLearning';
import { buildLiveAssistantSnapshot } from './assistantSnapshot';
import { normalizeTextForHebrewTTS } from './assistantTtsUtils';
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
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  speakText: (text: string) => void;
  stopSpeaking: () => void;
  providerConfig: AIProviderConfig;
  setProviderConfig: (config: AIProviderConfig) => void;
}

const AssistantContext = createContext<AssistantContextType | undefined>(undefined);

export const AssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname() || '/';
  const { user, allUsers } = useAuth();
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

  const [playbackRate, setPlaybackRateState] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('smartshare_assistant_rate');
        if (saved) {
          const parsed = parseFloat(saved);
          if (parsed >= 0.75 && parsed <= 2.0) return parsed;
        }
      } catch (_) {}
    }
    return 1.1; // Default slightly energetic & natural tempo
  });

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('smartshare_assistant_rate', String(rate));
      } catch (_) {}
    }
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
  const inflightAudioMapRef = React.useRef<Map<string, Promise<string | null>>>(new Map());
  const activeSpeakSeqRef = React.useRef<number>(0);

  const stopSpeaking = useCallback(() => {
    // Abort pending interactive fetch immediately
    if (ttsAbortControllerRef.current) {
      ttsAbortControllerRef.current.abort();
      ttsAbortControllerRef.current = null;
    }
    // Stop any currently playing audio and release Android OS AudioFocus so microphone works
    if (audioRef.current) {
      try {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      } catch (_) {}
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsAudioLoading(false);
  }, []);

  // Proactive background pre-synthesis: synthesizes and caches audio in the background
  // as soon as an answer arrives, so clicking "הקרא" plays in 0ms!
  const prefetchAudio = useCallback((rawText: string): Promise<string | null> => {
    if (typeof window === 'undefined') return Promise.resolve(null);
    const cleanText = normalizeTextForHebrewTTS(rawText);
    if (!cleanText) return Promise.resolve(null);

    const existingCached = audioCacheRef.current.get(cleanText);
    if (existingCached) return Promise.resolve(existingCached);

    const existingInflight = inflightAudioMapRef.current.get(cleanText);
    if (existingInflight) return existingInflight;

    const promise = (async () => {
      try {
        const res = await fetch('/api/assistant/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText })
        });
        if (!res.ok) return null;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        audioCacheRef.current.set(cleanText, url);
        return url;
      } catch {
        return null;
      } finally {
        inflightAudioMapRef.current.delete(cleanText);
      }
    })();

    inflightAudioMapRef.current.set(cleanText, promise);
    return promise;
  }, []);

  // Pre-synthesize the latest message when the user opens the assistant drawer
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      const lastAst = [...messages].reverse().find(m => m.sender === 'assistant');
      if (lastAst?.text) {
        prefetchAudio(lastAst.text);
      }
    }
  }, [isOpen, messages, prefetchAudio]);

  // Natural Human Hebrew TTS via Gemini Neural Voice (/api/assistant/tts) with singleton concurrency & client cache
  const speakText = useCallback(async (text: string) => {
    if (typeof window === 'undefined') return;

    // Immediately stop any prior speech or pending request (prevents double speech completely!)
    stopSpeaking();

    const cleanText = normalizeTextForHebrewTTS(text);
    if (!cleanText) return;

    // Monotonic counter to invalidate any outdated responses
    const seq = ++activeSpeakSeqRef.current;

    const playResolvedUrl = async (url: string): Promise<boolean> => {
      if (activeSpeakSeqRef.current !== seq) return true;
      setIsAudioLoading(false);
      setIsSpeaking(true);
      try {
        const audio = new Audio(url);
        audio.playbackRate = playbackRate;
        audioRef.current = audio;
        audio.onended = () => {
          if (activeSpeakSeqRef.current === seq) stopSpeaking();
        };
        audio.onerror = () => {
          if (activeSpeakSeqRef.current === seq) stopSpeaking();
        };
        await audio.play();
        return true;
      } catch (playErr) {
        console.warn('Audio play blocked or failed:', playErr);
        if (activeSpeakSeqRef.current === seq) stopSpeaking();
        return false;
      }
    };

    // 1. Check client audio cache for instant playback (0ms latency!)
    const cachedUrl = audioCacheRef.current.get(cleanText);
    if (cachedUrl) {
      await playResolvedUrl(cachedUrl);
      return;
    }

    setIsAudioLoading(true);

    // 2. If background pre-synthesis is already in flight for this exact message, join it!
    const inflight = inflightAudioMapRef.current.get(cleanText);
    if (inflight) {
      try {
        const url = await inflight;
        if (url && activeSpeakSeqRef.current === seq) {
          await playResolvedUrl(url);
          return;
        }
      } catch (_) {}
    }

    // 3. Otherwise fetch via streaming TTS endpoint
    const abortCtrl = new AbortController();
    ttsAbortControllerRef.current = abortCtrl;

    try {
      const res = await fetch('/api/assistant/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText }),
        signal: abortCtrl.signal
      });

      if (activeSpeakSeqRef.current !== seq) return;

      if (res.ok) {
        const blob = await res.blob();
        if (activeSpeakSeqRef.current !== seq) return;

        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        audioCacheRef.current.set(cleanText, url);

        await playResolvedUrl(url);
        return;
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || activeSpeakSeqRef.current !== seq) {
        return;
      }
      console.warn('TTS cloud audio failed:', err);
    }

    // Stop cleanly without switching to local browser voices that have strange accents (Russian/English)
    if (activeSpeakSeqRef.current === seq) {
      setIsAudioLoading(false);
      setIsSpeaking(false);
    }
  }, [stopSpeaking, playbackRate]);

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
    const liveData = buildLiveAssistantSnapshot(user, spaces, allUsers);
    const recentHistory = messages
      .filter(m => m.id !== 'welcome')
      .slice(-6)
      .map(m => ({ sender: m.sender, text: m.text }));
    const aiResult = await queryAIAssistant(sanitizedText, screenContext, providerConfig, liveData, recentHistory);
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

    // Auto-Speak or Background Pre-Synthesis:
    // If autoSpeak is ON, speak immediately. If OFF, pre-synthesize in the background so clicking "הקרא" is instant (0ms)!
    if (scrubbedAnswer) {
      if (autoSpeak) {
        speakText(scrubbedAnswer);
      } else {
        prefetchAudio(scrubbedAnswer);
      }
    }
  }, [screenContext, providerConfig, user, spaces, allUsers, messages, autoSpeak, speakText, prefetchAudio]);

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
        playbackRate,
        setPlaybackRate,
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

'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ScreenContext, getContextSuggestions } from './assistantKnowledge';
import { sanitizeAssistantQuery, filterAssistantResponse } from './assistantSecurity';
import { queryAIAssistant, AIProviderConfig } from './assistantProviderBridge';
import { logAssistantLearningEvent } from './assistantLearning';
import { executeLiveAssistantTools } from './assistantLiveTools';
import { normalizeTextForHebrewTTS } from './assistantTtsUtils';
import { detectBugReportIntent } from './assistantBugReporter';
import { recordUserAiTokenUsage, recordAiQuotaHit } from './assistantTokenTelemetry';
import type { AgentActionProposal, AgentActionExecutionResult } from './assistantActionRegistry';
import type { AgentActionPlan, AgentPlanExecutionReport } from './agentManifest';
import { executeAgentActionPlan } from './agentPlanOrchestrator';
import { executeApprovedAgentAction } from './assistantActionExecutor';
import { runPreExecutionClarityGate } from './agentClarityGate';
import { recordSkillSuccessFromAI } from './agentSkillCompiler';
import { registerAgentUndo, executeAgentUndo } from './agentUndoLedger';
import { useActiveGuestShareSession, extractGuestFirstName } from '@/utils/guestSessionContext';
import {
  type AssistantPersona,
  type AssistantPersonaId,
  getPersonaById,
  loadSavedPersonaId,
  savePersonaId,
  hasMetAssistantBefore,
  markAssistantMet,
  buildHumanGreeting
} from './assistantPersonas';
import { inspectLiveScreenDOM, executeLiveDomElementAction, isDestructiveUiLabel } from './assistantDomIntrospector';
import { findMatchingUiMacro, recordAiMacroSuccess } from './agentUiMacroLearner';
import {
  installPassiveUiMapLearner,
  installAutonomousScreenWatcher,
  recordUiTransition,
  markUiTransitionMissed,
  wasTriggerLearnedOnRoute
} from './assistantUiMapLearner';

export interface AgentExecutionStep {
  stepNumber: number;
  description: string;
  source: 'sdk_tool' | 'learned_map' | 'cloud_ai';
  learnedHits?: number;
  status: 'running' | 'done' | 'failed';
  detail?: string;
}
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
  isBugIntent?: boolean;
  proposedAction?: AgentActionProposal | null;
  actionStatus?: 'pending' | 'executing' | 'executed' | 'rejected' | 'failed';
  actionResult?: AgentActionExecutionResult;
  proposedPlan?: AgentActionPlan | null;
  planStatus?: 'pending' | 'executing' | 'executed' | 'rejected' | 'failed';
  planReport?: AgentPlanExecutionReport;
  executionSteps?: AgentExecutionStep[];
}

interface AssistantContextType {
  screenContext: ScreenContext;
  updateScreenContext: (updates: Partial<ScreenContext>) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<void>;
  approveProposedAction: (messageId: string) => Promise<void>;
  rejectProposedAction: (messageId: string) => void;
  approveProposedPlan: (messageId: string) => Promise<void>;
  rejectProposedPlan: (messageId: string) => void;
  actionToast: { message: string; proofUrl?: string; undoId?: string } | null;
  dismissActionToast: () => void;
  undoLastActionToast: () => Promise<void>;
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
  isIosInstallCoachActive: boolean;
  isAnalyzingInstallScreenshot: boolean;
  analyzeInstallScreenshot: (file: File) => Promise<void>;
  exitIosInstallCoach: () => void;
  selectedPersonaId: AssistantPersonaId;
  activePersona: AssistantPersona;
  setSelectedPersonaId: (id: AssistantPersonaId) => void;
  previewPersonaVoice: (id: AssistantPersonaId) => void;
}

const AssistantContext = createContext<AssistantContextType | undefined>(undefined);

export const AssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { user, allUsers } = useAuth();
  const {
    spaces,
    updateDocument,
    addDocumentFolder,
    updateDocumentFolder,
    removeDocument,
    updateInvoice,
    updateFileShareItems
  } = useSpaces();

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
  const [selectedPersonaId, setSelectedPersonaIdState] = useState<AssistantPersonaId>(() => loadSavedPersonaId());
  const activePersona = useMemo(() => getPersonaById(selectedPersonaId), [selectedPersonaId]);
  const selectedPersonaIdRef = React.useRef<AssistantPersonaId>(selectedPersonaId);
  selectedPersonaIdRef.current = selectedPersonaId;

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const initialPersona = getPersonaById(loadSavedPersonaId());
    const isFirstTime = !hasMetAssistantBefore();
    return [
      {
        id: 'welcome',
        sender: 'assistant',
        text: buildHumanGreeting(initialPersona, undefined, isFirstTime),
        timestamp: Date.now()
      }
    ];
  });

  const activeGuestSession = useActiveGuestShareSession();

  // Personalize initial welcome greeting with user's Hebrew first name once Auth loads (OR Guest's name on /share/[token]!)
  const personalizedWelcomeRef = React.useRef<string>('');
  useEffect(() => {
    const isShareRoute = pathname.startsWith('/share/');
    const guestFirst = isShareRoute ? extractGuestFirstName(activeGuestSession?.guestName) : '';
    if (isShareRoute && !user && guestFirst) {
      const sig = `guest:${activeGuestSession?.token}:${guestFirst}`;
      if (personalizedWelcomeRef.current === sig) return;
      personalizedWelcomeRef.current = sig;
      const senderPart = activeGuestSession?.senderName ? ` מ-${activeGuestSession.senderName}` : '';
      const greeting = `היי ${guestFirst}! 👋 נעים להכיר, אני ${activePersona.name} — העוזרת האישית של MySpace.\nקיבלת כאן גישה מאובטחת לקבצים ששותפו איתך${senderPart}. אני כאן אם תרצה עזרה בצפייה/הורדה, שליחת הודעה חזרה, או לשמוע איך תוכל גם אתה להקים מרחב חכם משלך בחינם ✨`;
      setMessages((prev) =>
        prev.length === 1 && prev[0].id === 'welcome'
          ? [
              {
                ...prev[0],
                text: greeting,
                followUps: [
                  'מה עוד MySpace יודעת לעשות?',
                  'איך מורידים או צופים בקבצים?',
                  'איך נרשמים בחינם?',
                ],
              },
            ]
          : prev
      );
      return;
    }

    const rawName = user?.realName || user?.nickname || (user as any)?.displayName;
    if (!rawName || personalizedWelcomeRef.current === `user:${rawName}`) return;
    personalizedWelcomeRef.current = `user:${rawName}`;
    const isFirstTime = !hasMetAssistantBefore();
    const greeting = buildHumanGreeting(activePersona, rawName, isFirstTime);
    setMessages((prev) =>
      prev.length === 1 && prev[0].id === 'welcome'
        ? [{ ...prev[0], text: greeting }]
        : prev
    );
  }, [user, activePersona, pathname, activeGuestSession]);

  const setSelectedPersonaId = useCallback((id: AssistantPersonaId) => {
    setSelectedPersonaIdState(id);
    selectedPersonaIdRef.current = id;
    savePersonaId(id);
  }, []);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('smartshare_assistant_autospeak');
        if (stored !== null) return stored === 'true';
        return true; // Default ON for all users (🔊 אוטו)
      } catch (_) {
        return true;
      }
    }
    return true;
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

  const hasGreetedRef = React.useRef(false);
  const approveActionRef = React.useRef<((id: string) => Promise<void>) | null>(null);
  const rejectActionRef = React.useRef<((id: string) => void) | null>(null);
  const approvePlanRef = React.useRef<((id: string) => Promise<void>) | null>(null);
  const rejectPlanRef = React.useRef<((id: string) => void) | null>(null);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        markAssistantMet();
        if (!hasGreetedRef.current && autoSpeak) {
          hasGreetedRef.current = true;
          const firstWelcome = messages.find((m) => m.id === 'welcome' && m.sender === 'assistant');
          if (firstWelcome?.text) {
            // Trigger inside user click gesture so iOS/Android allow immediate audio!
            void speakText(firstWelcome.text);
          }
        }
      }
      return next;
    });
  }, [autoSpeak, messages]);

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

    const voiceId = selectedPersonaIdRef.current;
    const cacheKey = `${voiceId}::${cleanText}`;
    const existingCached = audioCacheRef.current.get(cacheKey);
    if (existingCached) return Promise.resolve(existingCached);

    const existingInflight = inflightAudioMapRef.current.get(cacheKey);
    if (existingInflight) return existingInflight;

    const promise = (async () => {
      try {
        const res = await fetch('/api/assistant/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText, voiceId })
        });
        if (!res.ok) return null;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        audioCacheRef.current.set(cacheKey, url);
        return url;
      } catch {
        return null;
      } finally {
        inflightAudioMapRef.current.delete(cacheKey);
      }
    })();

    inflightAudioMapRef.current.set(cacheKey, promise);
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
  const speakText = useCallback(async (text: string, overrideVoiceId?: AssistantPersonaId) => {
    if (typeof window === 'undefined') return;

    // Immediately stop any prior speech or pending request (prevents double speech completely!)
    stopSpeaking();

    const cleanText = normalizeTextForHebrewTTS(text);
    if (!cleanText) return;

    const voiceId = overrideVoiceId || selectedPersonaIdRef.current;
    const cacheKey = `${voiceId}::${cleanText}`;

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
    const cachedUrl = audioCacheRef.current.get(cacheKey);
    if (cachedUrl) {
      await playResolvedUrl(cachedUrl);
      return;
    }

    setIsAudioLoading(true);

    // 2. If background pre-synthesis is already in flight for this exact message, join it!
    const inflight = inflightAudioMapRef.current.get(cacheKey);
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
        body: JSON.stringify({ text: cleanText, voiceId }),
        signal: abortCtrl.signal
      });

      if (activeSpeakSeqRef.current !== seq) return;

      if (res.ok) {
        const blob = await res.blob();
        if (activeSpeakSeqRef.current !== seq) return;

        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        audioCacheRef.current.set(cacheKey, url);

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

  // Install passive self-learning UI Map observer once (0ms overhead, 0 API calls, 0 host-app edits)
  useEffect(() => {
    const stopClicks = installPassiveUiMapLearner();
    const stopWatcher = installAutonomousScreenWatcher();
    return () => {
      stopClicks();
      stopWatcher();
    };
  }, []);

  const [isIosInstallCoachActive, setIsIosInstallCoachActive] = useState(false);
  const [isAnalyzingInstallScreenshot, setIsAnalyzingInstallScreenshot] = useState(false);

  const exitIosInstallCoach = useCallback(() => {
    setIsIosInstallCoachActive(false);
  }, []);

  // Dedicated Install-Only Screenshot Analyzer (strictly hits /api/assistant/install-vision with image ONLY, zero text prompt!)
  const analyzeInstallScreenshot = useCallback(async (file: File) => {
    if (!file || isAnalyzingInstallScreenshot) return;
    setIsAnalyzingInstallScreenshot(true);

    const userMsgId = `usr_img_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: '📸 שלחתי צילום מסך של ההתקנה — על מה ללחוץ עכשיו?',
        timestamp: Date.now(),
      },
    ]);

    try {
      // Compress screenshot client-side to max 900px JPEG (~80KB, fast upload & low token cost)
      const imgUrl = URL.createObjectURL(file);
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            const maxDim = 900;
            const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('No 2d context');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(imgUrl);
            resolve(canvas.toDataURL('image/jpeg', 0.72));
          } catch (err) {
            URL.revokeObjectURL(imgUrl);
            reject(err);
          }
        };
        img.onerror = (err) => {
          URL.revokeObjectURL(imgUrl);
          reject(err);
        };
        img.src = imgUrl;
      });

      const res = await fetch('/api/assistant/install-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType: 'image/jpeg' }),
      });

      const data = await res.json().catch(() => ({}));
      const replyText =
        data?.answer ||
        'לא הצלחתי לנתח את צילום המסך כרגע. נסה לצלם שוב או לחץ על סמל השיתוף הכחול למטה ובחר "הוסף למסך הבית".';

      setMessages((prev) => [
        ...prev,
        {
          id: `ast_vision_${Date.now()}`,
          sender: 'assistant',
          text: replyText,
          timestamp: Date.now(),
          source: 'cloud_llm',
          confidence: 'high',
          followUps: [
            'לחצתי על סמל השיתוף, מה שלב 2?',
            'לחצתי הוסף למסך הבית, מה שלב 3?',
            'הותקן בהצלחה, תודה!'
          ],
        },
      ]);

      if (autoSpeak) speakText(replyText);
      else prefetchAudio(replyText);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `ast_vision_err_${Date.now()}`,
          sender: 'assistant',
          text: 'לא הצלחתי לקרוא את התמונה. ודא שבחרת צילום מסך מהגלריה ונסה שוב.',
          timestamp: Date.now(),
          source: 'local_brain',
        },
      ]);
    } finally {
      setIsAnalyzingInstallScreenshot(false);
    }
  }, [isAnalyzingInstallScreenshot, autoSpeak, speakText, prefetchAudio]);

  // Interactive Step-by-Step iOS Install Walkthrough triggered from GlobalPWAPrompt (0 API tokens, voice + chat!)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStartIosCoach = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const isChromeIOS = Boolean(detail.isChromeIOS);
      const forceSpeak = Boolean(detail.autoSpeakNow);
      const introText = isChromeIOS
        ? 'שלום! אני הסוכן האישי שלך ואני כאן לעזור לך להתקין את מיי ספייס באייפון. שלב 1 מתוך 3: לחץ על סמל השיתוף בפינה העליונה של Chrome. הצלחת? אם הסתבכת, צלם מסך ושלח לי כאן עם כפתור 📸 ואגיד לך בדיוק על מה ללחוץ!'
        : 'שלום! אני הסוכן האישי שלך ואני כאן לעזור לך להתקין את מיי ספייס באייפון ב-3 לחיצות פשוטות. שלב 1 מתוך 3: תסתכל למטה באמצע הסרגל של Safari ולחץ על סמל השיתוף הכחול, ריבוע עם חץ עולה למעלה. הצלחת? אם הסתבכת, צלם מסך ושלח לי כאן עם כפתור 📸 ואגיד לך בדיוק על מה ללחוץ!';

      setIsIosInstallCoachActive(true);
      setIsOpen(true);
      setMessages((prev) => [
        ...prev,
        {
          id: `ios_coach_${Date.now()}`,
          sender: 'assistant',
          text: introText,
          timestamp: Date.now(),
          source: 'local_brain',
          confidence: 'high',
          followUps: [
            'לחצתי על סמל השיתוף, מה שלב 2?',
            'אני לא רואה את סמל השיתוף למטה',
            'התפריט שלי באנגלית, מה לבחור?'
          ]
        }
      ]);
      if (forceSpeak || autoSpeak) {
        speakText(introText);
      } else {
        prefetchAudio(introText);
      }
    };

    window.addEventListener('smartshare:start_ios_install_coach', handleStartIosCoach);
    return () => window.removeEventListener('smartshare:start_ios_install_coach', handleStartIosCoach);
  }, [autoSpeak, speakText, prefetchAudio]);

  // Send message with security validation + Hybrid Self-Healing 3-Step Autonomous Loop
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

    // 0-Token Hands-Free Siri Voice/Text Confirmation for Pending Headless Plan or Action!
    const cleanVoiceCmd = sanitizedText.trim().toLowerCase().replace(/[.!?,]/g, '');
    const latestPendingMsg = [...messages]
      .reverse()
      .find(
        (m) =>
          m.sender === 'assistant' &&
          ((m.proposedPlan && m.planStatus === 'pending') || (m.proposedAction && m.actionStatus === 'pending'))
      );

    if (latestPendingMsg) {
      const approveWords = ['אשר', 'מאשר', 'כן', 'תבצע', 'בצע', 'קדימה', 'תפעיל', 'הפעל', 'יאללה', 'מעולה תבצע', 'כן תבצע', 'ok', 'yes'];
      const rejectWords = ['בטל', 'לא', 'עצור', 'אל תבצע', 'ביטול', 'cancel', 'no'];
      if (approveWords.includes(cleanVoiceCmd)) {
        if (latestPendingMsg.proposedPlan && latestPendingMsg.planStatus === 'pending') {
          void approvePlanRef.current?.(latestPendingMsg.id);
        } else if (latestPendingMsg.proposedAction && latestPendingMsg.actionStatus === 'pending') {
          void approveActionRef.current?.(latestPendingMsg.id);
        }
        return;
      }
      if (rejectWords.includes(cleanVoiceCmd)) {
        if (latestPendingMsg.proposedPlan && latestPendingMsg.planStatus === 'pending') {
          rejectPlanRef.current?.(latestPendingMsg.id);
        } else if (latestPendingMsg.proposedAction && latestPendingMsg.actionStatus === 'pending') {
          rejectActionRef.current?.(latestPendingMsg.id);
        }
        return;
      }
    }

    // 0-Token Instant Interactive iOS Install Coach Steps
    const lowerQ = sanitizedText.toLowerCase();
    let instantIosReply: { text: string; followUps: string[] } | null = null;
    if (lowerQ.includes('לחצתי על סמל השיתוף') || lowerQ.includes('מה שלב 2')) {
      instantIosReply = {
        text: 'מעולה! שלב 2 מתוך 3: בתפריט הלבן שנפתח למטה, גלול מעט כלפי מטה עד שתראה את השורה "הוסף למסך הבית" (לידה יש סמל של ריבוע עם סימן פלוס). לחץ עליה!',
        followUps: ['לחצתי הוסף למסך הבית, מה שלב 3?', 'התפריט שלי באנגלית, מה לבחור?']
      };
    } else if (lowerQ.includes('מה שלב 3') || lowerQ.includes('לחצתי הוסף למסך הבית')) {
      instantIosReply = {
        text: 'אתה כמעט שם! שלב 3 ואחרון: בפינה העליונה של המסך לחץ על הכפתור הכחול "הוסף" (או Add). תוך שנייה הסמל של מיי ספייס יופיע על מסך הבית שלך כמו כל אפליקציה רגילה!',
        followUps: ['הותקן בהצלחה, תודה!']
      };
    } else if (lowerQ.includes('לא רואה את סמל השיתוף')) {
      instantIosReply = {
        text: 'שתי אפשרויות מהירות: אם הסרגל התחתון של Safari נעלם בגלל גלילה, פשוט גע קלות בקצה התחתון של המסך והוא יקפוץ חזרה. אם נכנסת מתוך וואטסאפ, לחץ על סמל המצפן הקטן בפינה התחתונה כדי לפתוח ב-Safari.',
        followUps: ['מצאתי! לחצתי על סמל השיתוף, מה שלב 2?']
      };
    } else if (lowerQ.includes('באנגלית') && (lowerQ.includes('תפריט') || lowerQ.includes('התקנ') || lowerQ.includes('לבחור'))) {
      instantIosReply = {
        text: 'באנגלית זה פשוט מאוד: גלול למטה בתפריט השיתוף ובחר Add to Home Screen (עם סימן הפלוס), ובמסך הבא לחץ Add בפינה העליונה.',
        followUps: ['לחצתי הוסף למסך הבית, מה שלב 3?']
      };
    }

    if (instantIosReply) {
      setMessages(prev => [
        ...prev,
        {
          id: `ios_step_${Date.now()}`,
          sender: 'assistant',
          text: instantIosReply!.text,
          timestamp: Date.now(),
          source: 'local_brain',
          confidence: 'high',
          followUps: instantIosReply!.followUps
        }
      ]);
      if (autoSpeak) speakText(instantIosReply.text);
      else prefetchAudio(instantIosReply.text);
      return;
    }

    // 0-Token Secure Guest Concierge on /share/[token] (Zero Data Leak + Personalized Conversion Engine!)
    if (!user && pathname.startsWith('/share/')) {
      const gFirst = extractGuestFirstName(activeGuestSession?.guestName);
      const namePrefix = gFirst ? `${gFirst}, ` : '';
      let guestReply = '';
      let guestFollowUps: string[] = ['מה עוד MySpace יודעת לעשות?', 'איך נרשמים בחינם?'];

      if (lowerQ.includes('הורד') || lowerQ.includes('צופ') || lowerQ.includes('קובץ') || lowerQ.includes('קבצים') || lowerQ.includes('תוכנית')) {
        guestReply = `${namePrefix}פשוט מאוד! לחץ על כל קובץ או תיקייה במסך כדי לפתוח תצוגה חדה במסך מלא (כולל זום לתוכניות PDF), או לחץ על כפתור ההורדה שליד הקובץ כדי לשמור אותו ישירות למכשיר שלך. אפשר גם להשאיר הודעה ישירה לבעל הקישור דרך כפתור הצ׳אט למעלה.`;
        guestFollowUps = ['מה עוד MySpace יודעת לעשות?', 'איך נרשמים בחינם?'];
      } else if (lowerQ.includes('נרשמ') || lowerQ.includes('להירשם') || lowerQ.includes('חינם') || lowerQ.includes('חשבון') || lowerQ.includes('הצטרף')) {
        guestReply = `${namePrefix}איזה כיף! ההרשמה ל-MySpace היא בחינם ולוקחת 10 שניות בלבד עם חשבון גוגל או טלפון. פשוט לחץ על לוגו MySpace למעלה או היכנס לדף הבית כדי לפתוח מרחב משלך — ותקבל כספת מסמכים, קיר שיתוף מאובטח עם מעקב צפיות, יומן שיתופי חכם והתחשבנויות במקום אחד!`;
        guestFollowUps = ['מה עוד MySpace יודעת לעשות?', 'איך מורידים או צופים בקבצים?'];
      } else if (lowerQ.includes('עוד') || lowerQ.includes('יודעת') || lowerQ.includes('יכולות') || lowerQ.includes('אפליקציה') || lowerQ.includes('myspace')) {
        guestReply = `${namePrefix}MySpace היא סביבת עבודה חכמה ומאובטחת שמרכזת הכל במקום אחד:\n• 🗂️ כספת מסמכים ותוכניות PDF עם שיתוף מאובטח ומעקב צפיות\n• 📅 לוח שנה שיתופי ואישי חכם (למשפחה, פרויקטים ונותני שירות)\n• 🧾 ניהול הוצאות והתחשבנויות שקוף בין שותפים\n• 🤖 עוזרת אישית קולית שמבצעת פעולות בשבילך\nאפשר להירשם בחינם ולהתחיל תוך שניות!`;
        guestFollowUps = ['איך נרשמים בחינם?', 'איך מורידים או צופים בקבצים?'];
      } else {
        guestReply = `היי ${gFirst || 'אורח'}! 😊 אני כאן כדי לעזור לך עם הקבצים ששותפו איתך בדף הזה. מכיוון שאתה גולש כאורח, יש לי גישה רק להדרכה על דף השיתוף הזה — אם תרצה, תוכל גם להירשם בחינם ל-MySpace ולהקים מרחב חכם משלך עם כספת קבצים, יומן שיתופי ועוזרת אישית!`;
        guestFollowUps = ['מה עוד MySpace יודעת לעשות?', 'איך מורידים או צופים בקבצים?', 'איך נרשמים בחינם?'];
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `guest_reply_${Date.now()}`,
          sender: 'assistant',
          text: guestReply,
          timestamp: Date.now(),
          source: 'local_brain',
          confidence: 'high',
          followUps: guestFollowUps,
        },
      ]);
      if (autoSpeak) speakText(guestReply);
      return;
    }

    const MAX_AUTONOMOUS_STEPS = 4;
    const execCtx = {
      user,
      spaces,
      router,
      spacesApi: { updateDocument, addDocumentFolder, updateDocumentFolder, removeDocument, updateInvoice, updateFileShareItems }
    };

    // Step 1: Full Zero-Trust Live Tools + Live DOM + Learned UI Map
    const liveData = executeLiveAssistantTools(user, spaces, allUsers, screenContext, sanitizedText);
    const recentHistory = messages
      .filter(m => m.id !== 'welcome')
      .slice(-6)
      .map(m => ({ sender: m.sender, text: m.text }));

    let currentDom = liveData.liveScreenDOM;
    const loopStartRoute = typeof window !== 'undefined' ? window.location.pathname : pathname;

    // 0-TOKEN UNIVERSAL MULTI-STEP UI MACRO REPLAY (Learned from passive daily clicks OR prior AI runs!)
    const matchedMacro = findMatchingUiMacro(sanitizedText, loopStartRoute, currentDom);
    if (matchedMacro) {
      const macroMsgId = `ast_macro_${Date.now()}`;
      const macroTimeline: AgentExecutionStep[] = [];
      const macroDoneLabels: string[] = [];
      let macroFailed = false;
      let latestDom = currentDom;

      setMessages((prev) => [
        ...prev,
        {
          id: macroMsgId,
          sender: 'assistant',
          text: `⚡ מפעילה מסלול שנלמד אוטומטית (${matchedMacro.macro.steps.join(' ← ')})...`,
          timestamp: Date.now(),
          source: 'local_brain',
          confidence: 'high',
          executionSteps: [],
        },
      ]);

      for (let idx = 0; idx < matchedMacro.macro.steps.length; idx++) {
        const targetLbl = matchedMacro.macro.steps[idx];
        const targetLower = targetLbl.toLowerCase();
        const foundEl = latestDom.interactiveElements.find((e) => {
          const elLbl = e.label.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
          return elLbl === targetLower || elLbl.includes(targetLower) || targetLower.includes(elLbl);
        });
        if (!foundEl || isDestructiveUiLabel(foundEl.label)) {
          macroFailed = true;
          break;
        }
        const clickRes = executeLiveDomElementAction(foundEl.agentId, 'click');
        if (!clickRes.success) {
          macroFailed = true;
          break;
        }
        macroDoneLabels.push(targetLbl);
        macroTimeline.push({
          stepNumber: idx + 1,
          description: `לחיצה אוטומטית על "${targetLbl}"`,
          source: 'learned_map',
          learnedHits: matchedMacro.macro.successCount,
          status: 'done',
        });
        await new Promise((r) => setTimeout(r, 380));
        latestDom = inspectLiveScreenDOM();
      }

      if (!macroFailed && macroDoneLabels.length === matchedMacro.macro.steps.length) {
        recordAiMacroSuccess({
          startRoute: loopStartRoute,
          steps: macroDoneLabels,
          endHeading: latestDom.openModalsOrBanners[0] || latestDom.visibleHeadings[0] || '',
          userQuery: sanitizedText,
        });

        let finalMacroAnswer = `בוצע! פתחתי עבורך את ${macroDoneLabels.join(' ← ')} (0 טוקנים — מסלול שנלמד מהשימוש שלך).`;

        // If user ALSO asked to read/report visible details from the opened screen, do ONLY 1 ultra-slim read call!
        if (matchedMacro.needsFinalScreenRead) {
          const readRes = await queryAIAssistant(
            sanitizedText,
            screenContext,
            providerConfig,
            undefined,
            undefined,
            {
              stepNumber: macroDoneLabels.length + 1,
              completedSteps: macroDoneLabels,
              liveScreenDOM: { ...latestDom, visibleButtonsAndActions: [] },
              availableActionTools: [],
            }
          );
          if (readRes.source === 'cloud_llm' && readRes.tokensUsed) {
            void recordUserAiTokenUsage(user?.id, readRes.tokensUsed);
          }
          if (readRes.text) {
            finalMacroAnswer = filterAssistantResponse(readRes.text);
            macroTimeline.push({
              stepNumber: macroTimeline.length + 1,
              description: 'קריאת תוכן המסך שנפתח',
              source: 'cloud_ai',
              status: 'done',
            });
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === macroMsgId
              ? { ...m, text: finalMacroAnswer, executionSteps: [...macroTimeline] }
              : m
          )
        );
        if (actionToastTimerRef.current) clearTimeout(actionToastTimerRef.current);
        setTimeout(() => {
          setIsOpen(false);
          setActionToast({ message: finalMacroAnswer });
          actionToastTimerRef.current = setTimeout(() => setActionToast(null), 7000);
        }, 850);
        if (autoSpeak) speakText(finalMacroAnswer);
        else prefetchAudio(finalMacroAnswer);
        return;
      } else {
        // Remove temporary macro message and gracefully fall back to full AI loop
        setMessages((prev) => prev.filter((m) => m.id !== macroMsgId));
        currentDom = inspectLiveScreenDOM();
      }
    }

    let aiResult = await queryAIAssistant(sanitizedText, screenContext, providerConfig, liveData, recentHistory);

    const recordTelemetry = (res: typeof aiResult) => {
      if (res.source === 'cloud_llm' && res.tokensUsed) {
        void recordUserAiTokenUsage(user?.id, res.tokensUsed);
      }
      if (res.quotaExceeded) {
        void recordAiQuotaHit(user?.id, res.quotaExceeded);
      }
    };
    recordTelemetry(aiResult);

    if (aiResult.confidence === 'low') {
      logAssistantLearningEvent(
        { type: 'unresolved', queryText: sanitizedText, confidence: 'low' },
        screenContext
      );
    }

    // Safety guard: force human confirmation if any UI target looks destructive
    const enforceDestructiveGuard = (
      prop: AgentActionProposal | null,
      dom: typeof currentDom
    ): AgentActionProposal | null => {
      if (!prop) return null;
      if (prop.tool === 'ui_click_element') {
        const targetId = String(prop.params?.agentId || '');
        const el = dom.interactiveElements.find((e) => e.agentId === targetId);
        if (isDestructiveUiLabel(el?.label || '') || isDestructiveUiLabel(prop.title)) {
          return { ...prop, requiresConfirmation: true, riskLevel: 'high' };
        }
      } else if (prop.tool === 'ui_execute_batch' && Array.isArray(prop.params?.steps)) {
        const hasDestructive = prop.params.steps.some((st: any) => {
          const el = dom.interactiveElements.find((e) => e.agentId === String(st?.agentId || ''));
          return isDestructiveUiLabel(el?.label || '');
        });
        if (hasDestructive || isDestructiveUiLabel(prop.title)) {
          return { ...prop, requiresConfirmation: true, riskLevel: 'high' };
        }
      }
      return prop;
    };

    let proposal = enforceDestructiveGuard(aiResult.proposedAction || null, currentDom);
    let finalAnswer = filterAssistantResponse(aiResult.text);
    let finalPlan = aiResult.proposedPlan || null;

    // Layer 5.5 — Deterministic Pre-Execution Policy, Clarity & Ambiguity Gate
    const clarityResult = runPreExecutionClarityGate({
      userQuery: sanitizedText,
      answer: finalAnswer,
      proposedAction: proposal,
      proposedPlan: finalPlan,
      liveScreenDOM: currentDom,
    });
    finalAnswer = clarityResult.answer;
    proposal = clarityResult.proposedAction;
    finalPlan = clarityResult.proposedPlan;

    const msgId = `ast_${Date.now()}`;

    const assistantMsg: ChatMessage = {
      id: msgId,
      sender: 'assistant',
      text: finalAnswer,
      timestamp: Date.now(),
      source: aiResult.source,
      fallbackReason: aiResult.fallbackReason,
      queryText: sanitizedText,
      nodeId: aiResult.nodeId,
      confidence: aiResult.confidence,
      followUps: aiResult.suggestions?.map(s => s.sampleQuestion).filter(Boolean).slice(0, 3),
      isBugIntent: detectBugReportIntent(sanitizedText),
      proposedAction: proposal,
      actionStatus: proposal ? (proposal.requiresConfirmation ? 'pending' : 'executing') : undefined,
      proposedPlan: finalPlan,
      planStatus: finalPlan ? 'pending' : undefined
    };
    setMessages(prev => [...prev, assistantMsg]);

    // Autonomous Multi-Step Loop (Hard-capped at MAX_AUTONOMOUS_STEPS = 3, zero user intervention for safe steps!)
    const completedSteps: string[] = [];
    const executedClickLabels: string[] = [];
    const timelineSteps: AgentExecutionStep[] = [];

    for (let stepNum = 1; stepNum <= MAX_AUTONOMOUS_STEPS; stepNum++) {
      if (!proposal || proposal.requiresConfirmation) break;

      const beforePath = typeof window !== 'undefined' ? window.location.pathname : '/';
      const beforeLabels = new Set(currentDom.interactiveElements.map((e) => e.label));
      const beforeModalsCount = currentDom.openModalsOrBanners.length;
      const clickedEl =
        proposal.tool === 'ui_click_element'
          ? currentDom.interactiveElements.find((e) => e.agentId === String(proposal?.params?.agentId || ''))
          : null;

      // Determine true step source transparently: Registered SDK Tool vs Learned UI Map vs Cloud AI
      let stepSource: AgentExecutionStep['source'] = 'cloud_ai';
      let learnedHits: number | undefined;
      if (!proposal.tool.startsWith('ui_')) {
        stepSource = 'sdk_tool';
      } else if (clickedEl?.label) {
        const learnedCheck = wasTriggerLearnedOnRoute(beforePath, clickedEl.label);
        if (learnedCheck.learned) {
          stepSource = 'learned_map';
          learnedHits = learnedCheck.hitCount;
        }
      }

      const humanDesc =
        proposal.title ||
        (clickedEl
          ? `${clickedEl.label}${clickedEl.contextHint ? ` (${clickedEl.contextHint})` : ''}`
          : proposal.summary || proposal.tool);

      const stepRecord: AgentExecutionStep = {
        stepNumber: stepNum,
        description: humanDesc,
        source: stepSource,
        learnedHits,
        status: 'running'
      };
      timelineSteps.push(stepRecord);

      setMessages(prev =>
        prev.map(m =>
          m.id === msgId
            ? { ...m, executionSteps: [...timelineSteps] }
            : m
        )
      );

      const execRes = await executeApprovedAgentAction(proposal, execCtx);
      completedSteps.push(humanDesc);
      if (execRes.success && clickedEl?.label) {
        executedClickLabels.push(clickedEl.label);
      }
      stepRecord.status = execRes.success ? 'done' : 'failed';
      stepRecord.detail = execRes.message;

      setMessages(prev =>
        prev.map(m =>
          m.id === msgId
            ? {
                ...m,
                text: finalAnswer,
                proposedAction: proposal,
                actionStatus: execRes.success ? 'executed' : 'failed',
                actionResult: execRes,
                executionSteps: [...timelineSteps]
              }
            : m
        )
      );

      // Stop if action failed or we reached step cap.
      // OPTION A (100% Universal, Zero Regex): Always verify physically after any UI action that changes the screen/modal!
      const isUiAction = proposal.tool === 'ui_click_element' || proposal.tool === 'ui_execute_batch';
      if (!execRes.success || stepNum >= MAX_AUTONOMOUS_STEPS || (!aiResult.continueExploring && !isUiAction)) {
        break;
      }

      // Wait for React DOM / modal to mount and settle, then re-scan live UI
      await new Promise((r) => setTimeout(r, 360));
      const afterDom = inspectLiveScreenDOM();
      const routeChanged = typeof window !== 'undefined' && window.location.pathname !== beforePath;
      const newControls = afterDom.interactiveElements
        .filter((e) => e.inModal || !beforeLabels.has(e.label))
        .map((e) => e.label);
      const textChanged =
        Boolean(afterDom.visibleScreenText) &&
        afterDom.visibleScreenText !== currentDom.visibleScreenText;
      const domChanged =
        routeChanged ||
        newControls.length > 0 ||
        afterDom.openModalsOrBanners.length !== beforeModalsCount ||
        textChanged;

      // Self-Healing & Auto-Learning from AI's own navigation!
      if (clickedEl?.label) {
        if (domChanged) {
          recordUiTransition({
            routePath: beforePath,
            triggerLabel: clickedEl.label,
            opensTitle: afterDom.openModalsOrBanners[0] || afterDom.visibleHeadings[0] || '',
            discoveredControls: newControls
          });
        } else {
          markUiTransitionMissed(beforePath, clickedEl.label);
          break; // Loop breaker: DOM didn't change, don't waste an API call!
        }
      } else if (!domChanged) {
        break;
      }

      currentDom = afterDom;

      // Show live progress while running Ultra-Slim Follow-Up API call (~85% fewer tokens!)
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId
            ? { ...m, text: `${finalAnswer}\n⏳ ממשיך לשלב ${stepNum + 1} מתוך ${MAX_AUTONOMOUS_STEPS}...` }
            : m
        )
      );

      aiResult = await queryAIAssistant(
        sanitizedText,
        screenContext,
        providerConfig,
        undefined,
        undefined,
        {
          stepNumber: stepNum + 1,
          completedSteps,
          liveScreenDOM: { ...afterDom, visibleButtonsAndActions: [] },
          availableActionTools: liveData.availableActionTools
        }
      );
      recordTelemetry(aiResult);

      finalAnswer = filterAssistantResponse(aiResult.text);
      proposal = enforceDestructiveGuard(aiResult.proposedAction || null, currentDom);

      setMessages(prev =>
        prev.map(m =>
          m.id === msgId
            ? {
                ...m,
                text: finalAnswer,
                proposedAction: proposal,
                actionStatus: proposal
                  ? (proposal.requiresConfirmation ? 'pending' : 'executing')
                  : 'executed'
              }
            : m
        )
      );
    }

    // Auto-Compile multi-step UI click chain into a 0-Token Learned UI Macro for future instant replay!
    if (executedClickLabels.length >= 2) {
      recordAiMacroSuccess({
        startRoute: loopStartRoute,
        steps: executedClickLabels.slice(0, 3),
        endHeading: currentDom.openModalsOrBanners[0] || currentDom.visibleHeadings[0] || '',
        userQuery: sanitizedText,
      });
    }

    // Smart Auto-Collapse when autonomous UI actions succeeded (reveals the opened screen immediately + shows top toast!)
    if (completedSteps.length > 0 && (!proposal || !proposal.requiresConfirmation)) {
      if (actionToastTimerRef.current) clearTimeout(actionToastTimerRef.current);
      const toastText = finalAnswer || completedSteps[completedSteps.length - 1] || 'הפעולה הושלמה בהצלחה';
      setTimeout(() => {
        setIsOpen(false);
        setActionToast({ message: toastText });
        actionToastTimerRef.current = setTimeout(() => {
          setActionToast(null);
        }, 7000);
      }, 950);
    }

    // Auto-Speak or Background Pre-Synthesis for final answer
    if (finalAnswer) {
      if (autoSpeak) {
        speakText(finalAnswer);
      } else {
        prefetchAudio(finalAnswer);
      }
    }
  }, [screenContext, providerConfig, user, spaces, allUsers, messages, autoSpeak, speakText, prefetchAudio, router, updateDocument, addDocumentFolder, updateDocumentFolder, removeDocument, updateInvoice]);

  const [actionToast, setActionToast] = useState<{ message: string; proofUrl?: string; undoId?: string } | null>(null);
  const actionToastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissActionToast = useCallback(() => {
    setActionToast(null);
    if (actionToastTimerRef.current) {
      clearTimeout(actionToastTimerRef.current);
      actionToastTimerRef.current = null;
    }
  }, []);

  const triggerSmartAutoCollapse = useCallback((message: string, proofUrl?: string, undoId?: string) => {
    if (actionToastTimerRef.current) clearTimeout(actionToastTimerRef.current);
    setTimeout(() => {
      setIsOpen(false);
      setActionToast({ message, proofUrl, undoId });
      actionToastTimerRef.current = setTimeout(() => {
        setActionToast(null);
      }, undoId ? 9000 : 6500);
    }, 850);
  }, []);

  const undoLastActionToast = useCallback(async () => {
    const uid = actionToast?.undoId;
    if (!uid) return;
    const res = await executeAgentUndo(uid);
    if (actionToastTimerRef.current) clearTimeout(actionToastTimerRef.current);
    setActionToast({ message: res.message });
    if (autoSpeak && res.message) speakText(res.message);
    actionToastTimerRef.current = setTimeout(() => setActionToast(null), 4000);
  }, [actionToast?.undoId, autoSpeak, speakText]);

  const approveProposedAction = useCallback(async (messageId: string) => {
    const target = messages.find(m => m.id === messageId);
    if (!target?.proposedAction || target.actionStatus !== 'pending') return;

    // Layer 6.5 — Capture Pre-Action Snapshot for 1-Tap Undo
    let capturedUndoId: string | undefined = undefined;
    try {
      const p: any = target.proposedAction.params || {};
      const toolName = target.proposedAction.tool;
      const targetSpace = spaces.find((s: any) => s.id === p.spaceId);
      if (targetSpace && (toolName === 'move_document' || toolName === 'transfer_items')) {
        const docId = p.documentId || p.itemId || (Array.isArray(p.itemIds) ? p.itemIds[0] : null);
        const origDoc = docId ? (targetSpace.documents || []).find((d: any) => d.id === docId) : null;
        if (origDoc) {
          const origFolderId = origDoc.folderId ?? null;
          const origShelfId = origDoc.shelfId;
          capturedUndoId = registerAgentUndo(`העברת "${origDoc.title || 'קובץ'}"`, () => {
            updateDocument(targetSpace.id, origDoc.id, { folderId: origFolderId, shelfId: origShelfId });
            return `↩️ "${origDoc.title || 'הקובץ'}" הוחזר למיקומו הקודם.`;
          });
        }
      } else if (targetSpace && toolName === 'set_item_permission') {
        const origFolder = p.itemType === 'folder' ? (targetSpace.documentFolders || []).find((f: any) => f.id === p.itemId) : null;
        const origDoc = p.itemType !== 'folder' ? (targetSpace.documents || []).find((d: any) => d.id === p.itemId) : null;
        if (origFolder) {
          const prevAllowed = [...(origFolder.allowedPartners || [])];
          capturedUndoId = registerAgentUndo(`הרשאת תיקייה "${origFolder.name}"`, () => {
            updateDocumentFolder(targetSpace.id, origFolder.id, { allowedPartners: prevAllowed });
            return `↩️ ההרשאה של "${origFolder.name}" הוחזרה לקדמותה.`;
          });
        } else if (origDoc) {
          const prevAllowed = [...(origDoc.allowedPartners || [])];
          capturedUndoId = registerAgentUndo(`הרשאת מסמך "${origDoc.title}"`, () => {
            updateDocument(targetSpace.id, origDoc.id, { allowedPartners: prevAllowed });
            return `↩️ ההרשאה של "${origDoc.title}" הוחזרה לקדמותה.`;
          });
        }
      }
    } catch {}

    setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, actionStatus: 'executing' } : m)));

    const result = await executeApprovedAgentAction(target.proposedAction, {
      user,
      spaces,
      router,
      spacesApi: { updateDocument, addDocumentFolder, updateDocumentFolder, removeDocument, updateInvoice, updateFileShareItems }
    });

    setMessages(prev =>
      prev.map(m =>
        m.id === messageId
          ? { ...m, actionStatus: result.success ? 'executed' : 'failed', actionResult: result }
          : m
      )
    );

    if (result.message && autoSpeak) {
      speakText(result.message);
    }

    if (result.success) {
      // ADR-013: Crystallize successful AI-guided action into Graduated Autonomy Skill Compiler
      recordSkillSuccessFromAI(target.queryText || target.proposedAction.title, target.proposedAction);
    }

    // Smart Auto-Collapse Pill: reveal the updated screen immediately if no follow-up WhatsApp CTA is pending
    if (result.success && !(result as any).whatsappUrl) {
      triggerSmartAutoCollapse(result.message || target.proposedAction.title, result.proofUrl, capturedUndoId);
    }
  }, [messages, user, spaces, router, updateDocument, addDocumentFolder, updateDocumentFolder, removeDocument, updateInvoice, updateFileShareItems, autoSpeak, speakText, triggerSmartAutoCollapse]);

  const rejectProposedAction = useCallback((messageId: string) => {
    setMessages(prev =>
      prev.map(m =>
        m.id === messageId
          ? { ...m, actionStatus: 'rejected', actionResult: { success: false, message: 'הפעולה בוטלה לבקשתך. לא בוצע שום שינוי.' } }
          : m
      )
    );
  }, []);

  const approveProposedPlan = useCallback(async (messageId: string) => {
    const target = messages.find(m => m.id === messageId);
    if (!target?.proposedPlan || target.planStatus !== 'pending') return;

    setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, planStatus: 'executing' } : m)));

    const report = await executeAgentActionPlan(
      target.proposedPlan,
      {
        user,
        spaces,
        router,
        spacesApi: { updateDocument, addDocumentFolder, updateDocumentFolder, removeDocument, updateInvoice, updateFileShareItems }
      },
      {
        intentText: target.queryText || target.proposedPlan.title,
        onStepProgress: (liveSteps) => {
          setMessages(prev =>
            prev.map(m =>
              m.id === messageId && m.proposedPlan
                ? { ...m, proposedPlan: { ...m.proposedPlan, steps: liveSteps } }
                : m
            )
          );
        }
      }
    );

    setMessages(prev =>
      prev.map(m =>
        m.id === messageId
          ? {
              ...m,
              planStatus: report.success ? 'executed' : 'failed',
              planReport: report,
              proposedPlan: m.proposedPlan ? { ...m.proposedPlan, steps: report.steps } : m.proposedPlan
            }
          : m
      )
    );

    if (report.finalMessage && autoSpeak) {
      speakText(report.finalMessage);
    }

    if (report.success && !(report as any).whatsappUrl) {
      triggerSmartAutoCollapse(report.finalMessage || target.proposedPlan.title, (report as any).proofUrl);
    }
  }, [messages, user, spaces, router, updateDocument, addDocumentFolder, updateDocumentFolder, removeDocument, updateInvoice, updateFileShareItems, autoSpeak, speakText, triggerSmartAutoCollapse]);

  const rejectProposedPlan = useCallback((messageId: string) => {
    setMessages(prev =>
      prev.map(m =>
        m.id === messageId
          ? {
              ...m,
              planStatus: 'rejected',
              planReport: {
                planId: m.proposedPlan?.id || '',
                success: false,
                completedSteps: 0,
                totalSteps: m.proposedPlan?.steps.length || 0,
                steps: m.proposedPlan?.steps || [],
                finalMessage: 'תוכנית הפעולה בוטלה לבקשתך. לא בוצע שום שינוי.'
              }
            }
          : m
      )
    );
  }, []);

  approveActionRef.current = approveProposedAction;
  rejectActionRef.current = rejectProposedAction;
  approvePlanRef.current = approveProposedPlan;
  rejectPlanRef.current = rejectProposedPlan;

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

  const previewPersonaVoice = useCallback((id: AssistantPersonaId) => {
    const p = getPersonaById(id);
    void speakText(p.sampleLine, id);
  }, [speakText]);

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
        approveProposedAction,
        rejectProposedAction,
        approveProposedPlan,
        rejectProposedPlan,
        actionToast,
        dismissActionToast,
        undoLastActionToast,
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
        setProviderConfig,
        isIosInstallCoachActive,
        isAnalyzingInstallScreenshot,
        analyzeInstallScreenshot,
        exitIosInstallCoach,
        selectedPersonaId,
        activePersona,
        setSelectedPersonaId,
        previewPersonaVoice
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

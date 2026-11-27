'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseSpeechToTextOptions {
  lang?: string;
  /** Default false (best for Android Chrome live streaming without duplication); true for long-form cursor editors */
  continuous?: boolean;
  /** Optional hook called right before starting mic (e.g. stop TTS playback so Android releases AudioFocus!) */
  onBeforeStart?: () => void;
  /** Called live while speaking with the full combined text (when continuous=false) or finalized phrase (when continuous=true) */
  onTranscript: (liveText: string, isFinal: boolean) => void;
  onError?: (reason: string) => void;
}

/**
 * Single-Source-of-Truth Free Live-Streaming Speech-to-Text Engine (Web Speech API, 0 API cost).
 * Battle-tested on Android Chrome & iOS Safari:
 * - Uses latest cumulative result entry when continuous=false to guarantee ZERO duplicate words on Android
 * - Releases AudioFocus via onBeforeStart()
 * - Detaches handlers BEFORE abort() on stop so stale late transcripts never re-populate cleared inputs!
 */
export function useSpeechToText({
  lang = 'he-IL',
  continuous = false,
  onBeforeStart,
  onTranscript,
  onError,
}: UseSpeechToTextOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef<string>('');
  const lastProcessedIdxRef = useRef<number>(0);

  const onBeforeStartRef = useRef(onBeforeStart);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onBeforeStartRef.current = onBeforeStart;
    onTranscriptRef.current = onTranscript;
    onErrorRef.current = onError;
  }, [onBeforeStart, onTranscript, onError]);

  const stopListening = useCallback((mode: 'abort' | 'stop' = 'abort') => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      // Detach handlers FIRST so Android SpeechRecognition cannot flush a late event after clear/send
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.onstart = null;
      try {
        if (mode === 'stop') rec.stop();
        else rec.abort();
      } catch {}
    }
    lastProcessedIdxRef.current = 0;
    setIsListening(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(Boolean(SR));
    return () => stopListening('abort');
  }, [stopListening]);

  const startListening = useCallback(
    (initialExistingText = '') => {
      if (typeof window === 'undefined') return;
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) {
        onErrorRef.current?.('דפדפן זה אינו תומך בזיהוי קולי ישיר. אנא השתמש בהקלדה.');
        return;
      }

      onBeforeStartRef.current?.();
      stopListening('abort');

      baseTextRef.current = initialExistingText.trim();
      lastProcessedIdxRef.current = 0;

      try {
        const recognition = new SR();
        recognition.lang = lang;
        recognition.continuous = continuous;
        recognition.interimResults = !continuous;
        recognition.maxAlternatives = 1;

        recognitionRef.current = recognition;

        recognition.onstart = () => {
          if (recognitionRef.current === recognition) setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          if (recognitionRef.current !== recognition) return;
          if (continuous) {
            for (let i = lastProcessedIdxRef.current; i < event.results.length; ++i) {
              if (event.results[i]?.isFinal) {
                const text = (event.results[i]?.[0]?.transcript || '').trim();
                if (text) onTranscriptRef.current(text, true);
                lastProcessedIdxRef.current = i + 1;
              }
            }
            return;
          }

          // Android Chrome proven pattern: latest result holds the cumulative utterance with zero duplication!
          const lastIdx = event.results.length - 1;
          const res = event.results[lastIdx];
          const transcript = (res?.[0]?.transcript || '').trim();
          if (transcript) {
            const base = baseTextRef.current;
            onTranscriptRef.current(base ? `${base} ${transcript}` : transcript, Boolean(res?.isFinal));
          }
        };

        recognition.onerror = (event: any) => {
          const code = event?.error || 'unknown';
          if (recognitionRef.current === recognition) {
            recognitionRef.current = null;
            setIsListening(false);
          }
          if (code === 'not-allowed' || code === 'service-not-allowed') {
            onErrorRef.current?.('הגישה למיקרופון חסומה בדפדפן. אנא אשר גישה למיקרופון בהגדרות הדפדפן.');
          } else if (code !== 'aborted' && code !== 'no-speech') {
            onErrorRef.current?.('לא ניתן להפעיל מיקרופון כרגע.');
          }
        };

        recognition.onend = () => {
          if (recognitionRef.current === recognition) {
            recognitionRef.current = null;
            setIsListening(false);
          }
          lastProcessedIdxRef.current = 0;
        };

        recognition.start();
        setIsListening(true);
      } catch {
        recognitionRef.current = null;
        setIsListening(false);
        onErrorRef.current?.('שגיאה בהפעלת הזיהוי הקולי.');
      }
    },
    [lang, continuous, stopListening]
  );

  const toggleListening = useCallback(
    (initialExistingText = '') => {
      if (isListening) {
        stopListening('stop');
      } else {
        startListening(initialExistingText);
      }
    },
    [isListening, startListening, stopListening]
  );

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
  };
}

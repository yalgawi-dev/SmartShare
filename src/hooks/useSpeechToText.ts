'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseSpeechToTextOptions {
  lang?: string;
  /** Called continuously with live interim + final text while the user is speaking */
  onTranscript: (liveText: string, isFinal: boolean) => void;
  onError?: (reason: string) => void;
}

/**
 * DRY Single-Source-of-Truth Free Live-Streaming Speech-to-Text Hook (Web Speech API, 0 API cost).
 * Streams Hebrew/English dictation live into any text field as the user speaks (`interimResults = true`),
 * with Android/iOS safe handler detachment on stop so duplicate late transcripts never flush.
 */
export function useSpeechToText({
  lang = 'he-IL',
  onTranscript,
  onError,
}: UseSpeechToTextOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef<string>('');
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onErrorRef.current = onError;
  }, [onTranscript, onError]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(Boolean(SR));
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        try {
          rec.abort();
        } catch {}
        recognitionRef.current = null;
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      // Detach handlers FIRST before abort() so Android cannot flush a stale final transcript
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(
    (initialExistingText = '') => {
      if (typeof window === 'undefined') return;
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) {
        onErrorRef.current?.('הדפדפן אינו תומך בהכתבה קולית.');
        return;
      }

      // Stop any previous active session cleanly
      stopListening();

      baseTextRef.current = initialExistingText.trim();

      try {
        const recognition = new SR();
        recognition.lang = lang;
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          let finalSegment = '';
          let interimSegment = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            const text = res?.[0]?.transcript || '';
            if (res.isFinal) {
              finalSegment += text;
            } else {
              interimSegment += text;
            }
          }

          const spoken = (finalSegment || interimSegment).trim();
          if (!spoken) return;
          const prefix = baseTextRef.current ? `${baseTextRef.current} ` : '';
          const combined = `${prefix}${spoken}`.trim();
          onTranscriptRef.current(combined, Boolean(finalSegment));
          if (finalSegment) {
            baseTextRef.current = combined;
          }
        };

        recognition.onerror = (ev: any) => {
          const code = ev?.error || 'unknown';
          if (code !== 'aborted' && code !== 'no-speech') {
            onErrorRef.current?.(
              code === 'not-allowed'
                ? 'יש לאשר גישה למיקרופון בדפדפן.'
                : 'לא ניתן להפעיל מיקרופון כרגע.'
            );
          }
          setIsListening(false);
          recognitionRef.current = null;
        };

        recognition.onend = () => {
          setIsListening(false);
          recognitionRef.current = null;
        };

        recognitionRef.current = recognition;
        setIsListening(true);
        recognition.start();
      } catch {
        setIsListening(false);
        recognitionRef.current = null;
        onErrorRef.current?.('שגיאה בהפעלת ההכתבה הקולית.');
      }
    },
    [lang, stopListening]
  );

  const toggleListening = useCallback(
    (initialExistingText = '') => {
      if (isListening) {
        stopListening();
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

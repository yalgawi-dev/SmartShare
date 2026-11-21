'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAssistant } from './AssistantContext';
import { useAuth } from '@/app/context/AuthContext';
import { APP_VERSION } from '@/constants/version';
import {
  BUG_VIDEO_MAX_SECONDS,
  BugReportRecord,
  captureLiveScreenBlob,
  LiveBugVideoRecorder,
  submitBugReportToAdmin,
  fetchAllBugReportsForAdmin,
  updateBugReportStatus,
  deleteBugReportRecord
} from './assistantBugReporter';

export const GlobalAssistantDrawer: React.FC = () => {
  const {
    screenContext,
    isOpen,
    toggleOpen,
    setIsOpen,
    messages,
    sendMessage,
    submitFeedback,
    suggestedQuestions,
    isSpeaking,
    isAudioLoading,
    autoSpeak,
    toggleAutoSpeak,
    playbackRate,
    setPlaybackRate,
    speakText,
    stopSpeaking,
    clearChat
  } = useAssistant();
  const { user } = useAuth();

  const [inputVal, setInputVal] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef<string>('');

  // BUG REPORTING & SCREEN CAPTURE / 35s VIDEO RECORDER STATE (Supports BOTH screenshot AND video simultaneously!)
  const [isBugComposerOpen, setIsBugComposerOpen] = useState(false);
  const [bugPanelTab, setBugPanelTab] = useState<'new' | 'list'>('new');
  const [bugReportsList, setBugReportsList] = useState<BugReportRecord[]>([]);
  const [isLoadingBugList, setIsLoadingBugList] = useState(false);
  const [bugDescription, setBugDescription] = useState('');
  const [bugScreenshotBlob, setBugScreenshotBlob] = useState<Blob | null>(null);
  const [bugScreenshotUrl, setBugScreenshotUrl] = useState<string | null>(null);
  const [bugVideoBlob, setBugVideoBlob] = useState<Blob | null>(null);
  const [bugVideoUrl, setBugVideoUrl] = useState<string | null>(null);
  const [bugVideoDurationSec, setBugVideoDurationSec] = useState<number>(0);
  const [isHidingForCapture, setIsHidingForCapture] = useState(false);
  const [isRecordingBugVideo, setIsRecordingBugVideo] = useState(false);
  const [recordingRemainingSec, setRecordingRemainingSec] = useState(BUG_VIDEO_MAX_SECONDS);
  const [isVideoRecordingAssistantVisible, setIsVideoRecordingAssistantVisible] = useState(false);
  const [isUploadingBugReport, setIsUploadingBugReport] = useState(false);
  const [bugUploadProgress, setBugUploadProgress] = useState(0);
  const [bugSentSuccess, setBugSentSuccess] = useState(false);
  const videoRecorderRef = useRef<LiveBugVideoRecorder | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const setScreenshotWithPreview = (blob: Blob | null) => {
    if (bugScreenshotUrl) URL.revokeObjectURL(bugScreenshotUrl);
    setBugScreenshotBlob(blob);
    setBugScreenshotUrl(blob ? URL.createObjectURL(blob) : null);
  };

  const setVideoWithPreview = (blob: Blob | null, durationSec = 0) => {
    if (bugVideoUrl) URL.revokeObjectURL(bugVideoUrl);
    setBugVideoBlob(blob);
    setBugVideoDurationSec(durationSec);
    setBugVideoUrl(blob ? URL.createObjectURL(blob) : null);
  };

  const loadBugReportsList = async () => {
    setIsLoadingBugList(true);
    try {
      const all = await fetchAllBugReportsForAdmin();
      // If Admin, show all system bug reports; otherwise show only current user's reported bugs
      const visible = user?.isAdmin ? all : all.filter((r) => r.reporter?.uid === (user?.id || 'guest'));
      setBugReportsList(visible);
    } catch (err) {
      console.warn('Error loading bug reports list:', err);
    } finally {
      setIsLoadingBugList(false);
    }
  };

  const handleQuickBugStatusChange = async (reportId: string, nextStatus: 'new' | 'in_progress' | 'resolved') => {
    try {
      await updateBugReportStatus(reportId, nextStatus);
      setBugReportsList((prev) => prev.map((r) => (r.id === reportId ? { ...r, status: nextStatus } : r)));
    } catch (_) {}
  };

  const handleQuickBugDelete = async (reportId: string) => {
    try {
      await deleteBugReportRecord(reportId);
      setBugReportsList((prev) => prev.filter((r) => r.id !== reportId));
    } catch (_) {}
  };

  const openBugComposerWithDefaultNote = (initialNote?: string) => {
    if (initialNote) {
      setBugDescription(initialNote);
    } else if (!bugDescription) {
      const lastUserMsg = [...messages].reverse().find((m) => m.sender === 'user');
      if (lastUserMsg?.text) setBugDescription(lastUserMsg.text);
    }
    setBugSentSuccess(false);
    setIsBugComposerOpen(true);
    setIsOpen(true);
    loadBugReportsList();
  };

  // 1. Hide Assistant -> Capture Instant WebP Screenshot (<30ms) -> Reopen Assistant
  const handleTakeBugScreenshot = async (initialNote?: string) => {
    stopSpeaking();
    if (initialNote) setBugDescription(initialNote);
    else if (!bugDescription) {
      const lastUserMsg = [...messages].reverse().find((m) => m.sender === 'user');
      if (lastUserMsg?.text) setBugDescription(lastUserMsg.text);
    }

    setIsHidingForCapture(true);
    await new Promise((r) => setTimeout(r, 220));
    try {
      const blob = await captureLiveScreenBlob();
      setScreenshotWithPreview(blob);
    } catch (err) {
      console.warn('Screenshot capture error:', err);
    } finally {
      setIsHidingForCapture(false);
      setBugSentSuccess(false);
      setIsBugComposerOpen(true);
      setIsOpen(true);
    }
  };

  // 2. Hide Assistant -> Record 35s Countdown Live Video + Voice + Touch -> Reopen Assistant
  const handleStartBugVideoRecording = async (initialNote?: string) => {
    stopSpeaking();
    if (initialNote) setBugDescription(initialNote);
    else if (!bugDescription) {
      const lastUserMsg = [...messages].reverse().find((m) => m.sender === 'user');
      if (lastUserMsg?.text) setBugDescription(lastUserMsg.text);
    }

    setIsHidingForCapture(true);
    setIsRecordingBugVideo(true);
    setIsVideoRecordingAssistantVisible(false);
    setRecordingRemainingSec(BUG_VIDEO_MAX_SECONDS);

    await new Promise((r) => setTimeout(r, 180));
    const recorder = new LiveBugVideoRecorder();
    videoRecorderRef.current = recorder;

    try {
      await recorder.start(
        (remaining) => {
          setRecordingRemainingSec(remaining);
        },
        (videoBlob, durationSec) => {
          setIsRecordingBugVideo(false);
          setIsHidingForCapture(false);
          setVideoWithPreview(videoBlob, durationSec);
          setBugSentSuccess(false);
          setIsBugComposerOpen(true);
          setIsOpen(true);
          videoRecorderRef.current = null;
        }
      );
    } catch (err: any) {
      setIsRecordingBugVideo(false);
      setIsHidingForCapture(false);
      setIsBugComposerOpen(true);
      setIsOpen(true);
      alert(err?.message || 'לא ניתן להתחיל הקלטת וידאו במכשיר זה.');
    }
  };

  const handleStopBugVideoRecording = () => {
    if (videoRecorderRef.current) {
      videoRecorderRef.current.stop();
    }
  };

  const handleAttachGalleryFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVid = file.type.startsWith('video/');
    if (isVid) {
      setVideoWithPreview(file, 0);
    } else {
      setScreenshotWithPreview(file);
    }
    setIsBugComposerOpen(true);
    e.target.value = '';
  };

  const handleSubmitBugReport = async () => {
    if (isUploadingBugReport) return;
    setIsUploadingBugReport(true);
    setBugUploadProgress(1);
    try {
      await submitBugReportToAdmin({
        user,
        screenContext,
        description: bugDescription || 'דיווח תקלה דרך הסוכן האישי',
        recentMessages: messages.map((m) => ({ sender: m.sender, text: m.text })),
        screenshotBlob: bugScreenshotBlob,
        videoBlob: bugVideoBlob,
        mediaDurationSec: bugVideoDurationSec,
        onUploadProgress: (pct) => setBugUploadProgress(Math.max(1, pct))
      });
      setBugUploadProgress(100);
      setBugSentSuccess(true);
      await loadBugReportsList();
      setTimeout(() => {
        setBugSentSuccess(false);
        setBugDescription('');
        setScreenshotWithPreview(null);
        setVideoWithPreview(null, 0);
        setBugPanelTab('list');
      }, 1200);
    } catch (err) {
      console.error('Failed submitting bug report:', err);
      alert('אירעה שגיאה בשליחת הדיווח. אנא נסה שוב.');
    } finally {
      setIsUploadingBugReport(false);
      setBugUploadProgress(0);
    }
  };

  // DRAGGABLE POSITION STATE (Persisted across pages)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    isDragging: boolean;
    hasDragged: boolean;
    startX: number;
    startY: number;
    initX: number;
    initY: number;
  }>({
    isDragging: false,
    hasDragged: false,
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0
  });

  // Modal Dragging State (allows moving the entire opened modal across the screen!)
  const [modalPosOffset, setModalPosOffset] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('smartshare_assistant_modal_pos');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            return parsed;
          }
        }
      } catch (_) {}
    }
    return { x: 0, y: 0 };
  });

  const modalDragRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    initX: number;
    initY: number;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0
  });

  const handleModalHeaderPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Don't drag if clicking buttons, inputs or links in header
    if (target.closest('button') || target.closest('input') || target.closest('a')) {
      return;
    }

    modalDragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initX: modalPosOffset.x,
      initY: modalPosOffset.y
    };

    const handlePointerMove = (moveEvt: PointerEvent) => {
      if (!modalDragRef.current.isDragging) return;
      const dx = moveEvt.clientX - modalDragRef.current.startX;
      const dy = moveEvt.clientY - modalDragRef.current.startY;
      setModalPosOffset({
        x: modalDragRef.current.initX + dx,
        y: modalDragRef.current.initY + dy
      });
    };

    const handlePointerUp = () => {
      if (modalDragRef.current.isDragging) {
        modalDragRef.current.isDragging = false;
        setModalPosOffset(pos => {
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('smartshare_assistant_modal_pos', JSON.stringify(pos));
            } catch (_) {}
          }
          return pos;
        });
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  // Load saved position on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('smartshare_assistant_pos');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            const maxX = Math.max(0, window.innerWidth - 65);
            const maxY = Math.max(0, window.innerHeight - 65);
            setPosition({
              x: Math.min(Math.max(10, parsed.x), maxX),
              y: Math.min(Math.max(10, parsed.y), maxY)
            });
            return;
          }
        }
        // Default initial position: Bottom right above floating bar
        setPosition({
          x: Math.max(10, window.innerWidth - 75),
          y: Math.max(10, window.innerHeight - 150)
        });
      } catch (e) {
        console.warn('Error reading assistant pos', e);
      }
    }
  }, []);

  // Drag handlers using window pointer listeners
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag with primary pointer button
    if (e.button !== 0) return;
    const currentX = position?.x ?? (window.innerWidth - 75);
    const currentY = position?.y ?? (window.innerHeight - 150);

    dragRef.current = {
      isDragging: true,
      hasDragged: false,
      startX: e.clientX,
      startY: e.clientY,
      initX: currentX,
      initY: currentY
    };

    const handlePointerMove = (moveEvt: PointerEvent) => {
      if (!dragRef.current.isDragging) return;
      const dx = moveEvt.clientX - dragRef.current.startX;
      const dy = moveEvt.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        dragRef.current.hasDragged = true;
      }
      const newX = Math.min(Math.max(10, dragRef.current.initX + dx), window.innerWidth - 65);
      const newY = Math.min(Math.max(10, dragRef.current.initY + dy), window.innerHeight - 65);
      setPosition({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      if (dragRef.current.isDragging) {
        dragRef.current.isDragging = false;
        setPosition(pos => {
          if (pos && typeof window !== 'undefined') {
            try {
              localStorage.setItem('smartshare_assistant_pos', JSON.stringify(pos));
            } catch (_) {}
          }
          return pos;
        });
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Clean up speech recognition if drawer closes or unmounts
  useEffect(() => {
    if (!isOpen && recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
      setIsListening(false);
    }
  }, [isOpen]);

  // Speech-to-Text via Web Speech API (with Android AudioFocus release & live interim preview)
  const handleToggleVoiceInput = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('דפדפן זה אינו תומך בזיהוי קולי ישיר. אנא השתמש בהקלדה.');
      return;
    }

    // 1. If currently listening, stop cleanly via recognitionRef
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
        recognitionRef.current = null;
      }
      setIsListening(false);
      return;
    }

    // 2. Immediately stop any active TTS audio playback so Android releases AudioFocus for the microphone!
    stopSpeaking();

    // 3. Abort any stale recognition instance that may still hold the browser mic lock
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {}
      recognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'he-IL';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      baseInputRef.current = inputVal.trim();
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        // On Android Chrome with continuous=false & interimResults=true,
        // the latest result entry holds the cumulative utterance without duplication
        const lastIdx = event.results.length - 1;
        const transcript = (event.results[lastIdx]?.[0]?.transcript || '').trim();
        if (transcript) {
          const base = baseInputRef.current;
          setInputVal(base ? `${base} ${transcript}` : transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        recognitionRef.current = null;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          alert('הגישה למיקרופון חסומה בדפדפן. אנא אשר גישה למיקרופון בהגדרות הדפדפן.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setIsListening(false);
      recognitionRef.current = null;
    }
  };

  const handleSend = async (textToSend?: string) => {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
      setIsListening(false);
    }
    const text = (textToSend || inputVal).trim();
    if (!text) return;
    setInputVal('');
    baseInputRef.current = '';
    await sendMessage(text);
  };

  return (
    <>
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={handleAttachGalleryFile}
      />

      {/* FLOATING 35s COUNTDOWN VIDEO RECORDER HUD (Shown while Assistant is hidden during bug recording) */}
      {isRecordingBugVideo && (
        <div
          data-bug-recorder-hud="true"
          style={{
            position: 'fixed',
            top: '14px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2147483645,
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(8px)',
            color: '#ffffff',
            padding: '8px 14px',
            borderRadius: '999px',
            boxShadow: '0 10px 25px rgba(239, 68, 68, 0.38)',
            border: '2px solid #ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            direction: 'rtl',
            fontSize: '0.80rem',
            fontWeight: 700
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#fca5a5' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
            מקליט מסך וקול
          </span>
          <span
            style={{
              background: recordingRemainingSec <= 10 ? '#dc2626' : '#334155',
              color: '#ffffff',
              padding: '2px 9px',
              borderRadius: '999px',
              fontFamily: 'monospace',
              fontSize: '0.88rem',
              fontWeight: 900
            }}
          >
            ⏱️ 00:{String(recordingRemainingSec).padStart(2, '0')}
          </span>

          {/* Toggle Assistant Visibility while recording so user can capture bugs IN the Assistant itself! */}
          <button
            type="button"
            onClick={() => setIsVideoRecordingAssistantVisible((prev) => !prev)}
            style={{
              background: isVideoRecordingAssistantVisible ? '#2563eb' : 'rgba(255,255,255,0.22)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: '999px',
              padding: '4px 10px',
              fontSize: '0.73rem',
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            title="הצג או הסתר את חלון העוזר בזמן ההקלטה כדי לצלם תקלה בעוזר עצמו"
          >
            {isVideoRecordingAssistantVisible ? '🤖 הסתר עוזר' : '🤖 הצג עוזר'}
          </button>

          <button
            type="button"
            onClick={handleStopBugVideoRecording}
            style={{
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '999px',
              padding: '4px 12px',
              fontSize: '0.76rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            ⏹️ סיים ושלח
          </button>
        </div>
      )}

      {/* FLOATING ACTION ORB (Top-most zIndex so it always appears above any open modal!) */}
      {!isHidingForCapture && !isRecordingBugVideo && (
      <div
        data-assistant-drawer="true"
        onPointerDown={handlePointerDown}
        style={{
          position: 'fixed',
          left: position ? `${position.x}px` : 'auto',
          top: position ? `${position.y}px` : 'auto',
          right: position ? 'auto' : '24px',
          bottom: position ? 'auto' : '150px',
          zIndex: 2147483640,
          direction: 'rtl',
          touchAction: 'none',
          userSelect: 'none'
        }}
      >
        <button
          type="button"
          onClick={() => {
            // Only trigger click if user didn't drag
            if (!dragRef.current.hasDragged) {
              toggleOpen();
            }
          }}
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
            border: '2.5px solid #ffffff',
            color: '#ffffff',
            fontSize: '1.4rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'grab',
            boxShadow: '0 8px 24px rgba(79, 70, 229, 0.45)',
            transition: 'transform 0.15s ease',
            transform: isOpen ? 'scale(0.92)' : 'scale(1)'
          }}
          title="עוזר אישי חכם (גרור כדי להזיז לכל מקום)"
        >
          {isOpen ? '✕' : '🤖'}
        </button>
      </div>
      )}

      {/* ASSISTANT SLIDE-OVER DRAWER (Top-most zIndex so it always appears above any open modal) */}
      {isOpen && (!isHidingForCapture || isVideoRecordingAssistantVisible) && (!isRecordingBugVideo || isVideoRecordingAssistantVisible) && (() => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
        return (
        <div
          data-assistant-drawer="true"
          style={{
            position: 'fixed',
            left: isMobile ? '12px' : (position ? Math.min(Math.max(16, position.x - 340), window.innerWidth - 400) : 'auto'),
            right: isMobile ? '12px' : (position ? 'auto' : '24px'),
            bottom: isMobile ? '100px' : '90px',
            top: 'auto',
            width: isMobile ? 'auto' : '380px',
            maxWidth: isMobile ? 'none' : 'calc(100vw - 32px)',
            height: isMobile ? '68dvh' : '540px',
            maxHeight: isMobile ? 'calc(100dvh - 130px)' : 'calc(100dvh - 110px)',
            background: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 20px 45px rgba(0,0,0,0.22)',
            border: '1.5px solid #e2e8f0',
            zIndex: 2147483640,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            direction: 'rtl',
            animation: 'fadeIn 0.2s ease-out',
            transform: `translate3d(${modalPosOffset.x}px, ${modalPosOffset.y}px, 0)`,
            transition: modalDragRef.current.isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
        >
          {/* Header (Draggable on Touch & Mouse, with visual handle indicator) */}
          <div
            onPointerDown={handleModalHeaderPointerDown}
            style={{
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              flexShrink: 0,
              cursor: 'grab',
              touchAction: 'none',
              userSelect: 'none'
            }}
            title="גרור מכאן כדי להזיז את חלון העוזר לכל מקום במסך"
          >
            {/* Visual Drag Handle Bar */}
            <div style={{ alignSelf: 'center', width: '36px', height: '4px', background: 'rgba(255,255,255,0.4)', borderRadius: '999px', marginBottom: '2px' }} />
            {/* Top Row: Title + Version on Right | Reset + Close ✕ on Left */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>🤖</span>
                <span style={{ fontWeight: 900, fontSize: '0.94rem', whiteSpace: 'nowrap' }}>
                  עוזר אישי MySpace
                </span>
                <span style={{ fontSize: '0.66rem', background: 'rgba(255,255,255,0.25)', padding: '1px 6px', borderRadius: '6px', fontWeight: 700, flexShrink: 0 }}>
                  {APP_VERSION}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={clearChat}
                  style={{
                    background: 'rgba(255,255,255,0.18)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    width: '28px',
                    height: '28px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="אפס שיחה"
                >
                  🔄
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: 'rgba(255,255,255,0.25)',
                    border: 'none',
                    borderRadius: '50%',
                    color: '#ffffff',
                    width: '28px',
                    height: '28px',
                    fontSize: '0.95rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                  title="סגור עוזר אישי"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Bottom Row: AI Status on Right | Action Controls (Bug, Speed, Auto-Speak, Stop) on Left */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.67rem', opacity: 0.95, display: 'flex', alignItems: 'center', gap: '5px' }}>
                {(() => {
                  const lastAst = [...messages].reverse().find(m => m.sender === 'assistant' && m.source);
                  if (!lastAst) {
                    return <span style={{ background: 'rgba(16,185,129,0.32)', padding: '2px 7px', borderRadius: '6px', fontWeight: 800 }}>✨ AI מוכן</span>;
                  }
                  return lastAst.source === 'cloud_llm' ? (
                    <span style={{ background: 'rgba(16,185,129,0.35)', padding: '2px 7px', borderRadius: '6px', fontWeight: 800 }}>✨ AI חכם פעיל</span>
                  ) : (
                    <span style={{ background: 'rgba(245,158,11,0.35)', padding: '2px 7px', borderRadius: '6px', fontWeight: 800 }}>
                      🧠 מקומי{lastAst.fallbackReason ? ` (${lastAst.fallbackReason})` : ''}
                    </span>
                  );
                })()}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                {/* Report Bug to Admin Quick Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (isBugComposerOpen) setIsBugComposerOpen(false);
                    else openBugComposerWithDefaultNote();
                  }}
                  style={{
                    background: isBugComposerOpen ? '#ef4444' : 'rgba(239,68,68,0.35)',
                    border: '1px solid rgba(255,255,255,0.5)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '2px 7px',
                    fontSize: '0.70rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                  title="דווח על תקלה למנהל המערכת (צילום מסך או סרטון 35 שניות)"
                >
                  🐞 תקלה
                </button>

                {/* Playback Speed Selector */}
                <button
                  type="button"
                  onClick={() => {
                    const rates = [0.85, 1.0, 1.15, 1.35, 1.5];
                    const curIdx = rates.findIndex(r => Math.abs(r - playbackRate) < 0.05);
                    const nextRate = rates[(curIdx + 1) % rates.length];
                    setPlaybackRate(nextRate);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '2px 6px',
                    fontSize: '0.70rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  title="שנה מהירות הקראה"
                >
                  {playbackRate}x
                </button>

                {/* Auto-Speak Toggle Button */}
                <button
                  type="button"
                  onClick={toggleAutoSpeak}
                  style={{
                    background: autoSpeak ? '#10b981' : 'rgba(255,255,255,0.2)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '2px 7px',
                    fontSize: '0.71rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                  title={autoSpeak ? 'הקראה אוטומטית פועלת - לחץ לכיבוי' : 'הקראה אוטומטית כבויה - לחץ להפעלה'}
                >
                  {autoSpeak ? '🔊 אוטו' : '🔇 שקט'}
                </button>

                {isSpeaking && (
                  <button
                    type="button"
                    onClick={stopSpeaking}
                    style={{
                      background: 'rgba(239,68,68,0.85)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      padding: '2px 7px',
                      fontSize: '0.71rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                    title="הפסק הקראה"
                  >
                    ⏹️ עצור
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Context Banner */}
          <div style={{ padding: '5px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.71rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span>📍</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                מיקום נוכחי:{' '}
                {screenContext.spaceTitle
                  ? `מרחב "${screenContext.spaceTitle}"${screenContext.currentFolderName ? ` › ${screenContext.currentFolderName}` : ''}`
                  : screenContext.route?.startsWith('/space/')
                    ? 'בתוך מרחב עבודה'
                    : screenContext.route?.startsWith('/settings')
                      ? 'הגדרות'
                      : screenContext.route?.startsWith('/admin')
                        ? 'ניהול מערכת'
                        : 'דף ראשי'}
              </span>
            </div>
            {screenContext.activeWidget && screenContext.activeWidget !== 'general' && (
              <span style={{ fontSize: '0.65rem', background: '#e0e7ff', color: '#4338ca', padding: '1px 6px', borderRadius: '4px', fontWeight: 700, flexShrink: 0 }}>
                {screenContext.activeWidget === 'accounting' ? 'הוצאות' : screenContext.activeWidget === 'documents' ? 'מסמכים' : screenContext.activeWidget === 'fileshare' ? 'שיתוף' : screenContext.activeWidget === 'partners' ? 'שותפים' : screenContext.activeWidget}
              </span>
            )}
          </div>

          {/* BUG REPORT COMPOSER & LIVE BUG LIST PANEL (Collapsible with clear visual toggle) */}
          {isBugComposerOpen && (
            <div
              style={{
                background: '#fff1f2',
                borderBottom: '2px solid #fecdd3',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                maxHeight: '100%',
                overflow: 'hidden'
              }}
            >
              {/* Top Bar with 2 Tabs: New Bug vs Bug List & Status */}
              <div style={{ padding: '7px 12px', borderBottom: '1px solid #fecdd3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button
                    type="button"
                    onClick={() => setBugPanelTab('new')}
                    style={{
                      background: bugPanelTab === 'new' ? '#be123c' : '#ffffff',
                      color: bugPanelTab === 'new' ? '#ffffff' : '#9f1239',
                      border: '1px solid #f43f5e',
                      borderRadius: '8px',
                      padding: '4px 9px',
                      fontSize: '0.72rem',
                      fontWeight: 900,
                      cursor: 'pointer'
                    }}
                  >
                    ➕ דיווח חדש
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBugPanelTab('list');
                      loadBugReportsList();
                    }}
                    style={{
                      background: bugPanelTab === 'list' ? '#be123c' : '#ffffff',
                      color: bugPanelTab === 'list' ? '#ffffff' : '#9f1239',
                      border: '1px solid #f43f5e',
                      borderRadius: '8px',
                      padding: '4px 9px',
                      fontSize: '0.72rem',
                      fontWeight: 900,
                      cursor: 'pointer'
                    }}
                  >
                    📋 רשימת תקלות וסטטוס ({bugReportsList.length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsBugComposerOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: '#9f1239', cursor: 'pointer', fontWeight: 900, fontSize: '0.76rem' }}
                >
                  ✕ סגור
                </button>
              </div>

              {bugPanelTab === 'list' ? (
                <div
                  style={{
                    padding: '8px 10px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '0.73rem'
                  }}
                >
                  {isLoadingBugList ? (
                    <div style={{ textAlign: 'center', padding: '16px', color: '#64748b', fontWeight: 700 }}>
                      טוען רשימת תקלות...
                    </div>
                  ) : bugReportsList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px', color: '#64748b', fontWeight: 700 }}>
                      אין תקלות ברשימה כרגע.
                    </div>
                  ) : (
                    bugReportsList.map((rep, idx) => {
                      const statusColors = {
                        new: { label: '🔴 חדש', bg: '#fff1f2', text: '#be123c' },
                        in_progress: { label: '🟡 בטיפול', bg: '#fef3c7', text: '#b45309' },
                        resolved: { label: '🟢 טופל', bg: '#dcfce7', text: '#15803d' }
                      };
                      const st = statusColors[rep.status] || statusColors.new;

                      return (
                        <div
                          key={rep.id || idx}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #fda4af',
                            borderRadius: '10px',
                            padding: '8px 10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '5px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            <span style={{ fontWeight: 900, color: '#0f172a', fontSize: '0.78rem' }}>
                              #{idx + 1} • {rep.description}
                            </span>
                            <span style={{ background: st.bg, color: st.text, padding: '2px 7px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 900, flexShrink: 0 }}>
                              {st.label}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', fontSize: '0.68rem', color: '#64748b' }}>
                            <span>
                              👤 {rep.reporter?.name || 'אורח'} • 📍 {rep.telemetry?.spaceTitle || 'דף ראשי'} • 🕒 {new Date(rep.createdAt).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>

                            {/* If Admin, allow 1-tap status update & delete directly in the list! */}
                            {user?.isAdmin && rep.id && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleQuickBugStatusChange(rep.id!, 'new')}
                                  style={{ background: rep.status === 'new' ? '#be123c' : '#f1f5f9', color: rep.status === 'new' ? '#fff' : '#475569', border: 'none', borderRadius: '5px', padding: '2px 6px', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer' }}
                                >
                                  חדש
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickBugStatusChange(rep.id!, 'in_progress')}
                                  style={{ background: rep.status === 'in_progress' ? '#d97706' : '#f1f5f9', color: rep.status === 'in_progress' ? '#fff' : '#475569', border: 'none', borderRadius: '5px', padding: '2px 6px', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer' }}
                                >
                                  בטיפול
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickBugStatusChange(rep.id!, 'resolved')}
                                  style={{ background: rep.status === 'resolved' ? '#16a34a' : '#f1f5f9', color: rep.status === 'resolved' ? '#fff' : '#475569', border: 'none', borderRadius: '5px', padding: '2px 6px', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer' }}
                                >
                                  טופל
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickBugDelete(rep.id!)}
                                  style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '5px', padding: '2px 6px', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer' }}
                                  title="מחק תקלה"
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <>
              {/* Scrollable Composer Body */}
              <div
                style={{
                  padding: '8px 12px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '7px',
                  fontSize: '0.75rem'
                }}
              >
                {/* Auto-attached User Card Summary (BiDi-isolated chips so icons and text never scramble!) */}
                <div
                  style={{
                    background: '#ffffff',
                    padding: '5px 8px',
                    borderRadius: '8px',
                    border: '1px solid #fecdd3',
                    fontSize: '0.68rem',
                    color: '#475569',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 800, color: '#0f172a' }}>
                    <span>👤</span>
                    <span>{user?.realName || user?.nickname || 'אורח'}</span>
                  </span>
                  <span>•</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <span>📱</span>
                    <span dir="ltr">{user?.phone || 'ללא טלפון'}</span>
                  </span>
                  <span>•</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                    <span>📍</span>
                    <span>{screenContext.spaceTitle || 'דף ראשי'}</span>
                  </span>
                </div>

                {/* Screen Capture / 35s Video Recording Controls */}
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleTakeBugScreenshot()}
                    style={{
                      flex: 1,
                      background: bugScreenshotUrl ? '#ffe4e6' : '#ffffff',
                      border: '1.5px solid #f43f5e',
                      color: '#be123c',
                      padding: '5px 7px',
                      borderRadius: '8px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    📸 {bugScreenshotUrl ? 'צלם שוב' : 'צלם מסך חי'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartBugVideoRecording()}
                    style={{
                      flex: 1,
                      background: '#e11d48',
                      border: 'none',
                      color: '#ffffff',
                      padding: '5px 7px',
                      borderRadius: '8px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    🎥 {bugVideoUrl ? 'הקלט שוב' : `הקלט סרטון (00:${BUG_VIDEO_MAX_SECONDS})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#334155',
                      padding: '5px 7px',
                      borderRadius: '8px',
                      fontSize: '0.71rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                    title="צרף צילום מסך או סרטון מהמכשיר"
                  >
                    📎 מהמכשיר
                  </button>
                </div>

                {/* Attached Media Previews (Supports BOTH Screenshot AND Video side-by-side!) */}
                {(bugScreenshotUrl || bugVideoUrl) && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {bugScreenshotUrl && (
                      <div style={{ flex: 1, position: 'relative', background: '#0f172a', borderRadius: '8px', overflow: 'hidden', height: '84px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={bugScreenshotUrl} alt="צילום תקלה" style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' }} />
                        <span style={{ position: 'absolute', bottom: '3px', right: '5px', background: 'rgba(15,23,42,0.8)', color: '#fff', fontSize: '0.62rem', padding: '1px 5px', borderRadius: '4px' }}>
                          📸 תמונה
                        </span>
                        <button
                          type="button"
                          onClick={() => setScreenshotWithPreview(null)}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            left: '4px',
                            background: 'rgba(239,68,68,0.92)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '5px',
                            padding: '1px 6px',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          🗑️ הסר
                        </button>
                      </div>
                    )}
                    {bugVideoUrl && (
                      <div style={{ flex: 1, position: 'relative', background: '#0f172a', borderRadius: '8px', overflow: 'hidden', height: '84px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <video src={bugVideoUrl} controls style={{ maxHeight: '80px', maxWidth: '100%' }} />
                        <span style={{ position: 'absolute', bottom: '3px', right: '5px', background: 'rgba(15,23,42,0.8)', color: '#fff', fontSize: '0.62rem', padding: '1px 5px', borderRadius: '4px', pointerEvents: 'none' }}>
                          🎥 סרטון
                        </span>
                        <button
                          type="button"
                          onClick={() => setVideoWithPreview(null, 0)}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            left: '4px',
                            background: 'rgba(239,68,68,0.92)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '5px',
                            padding: '1px 6px',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          🗑️ הסר
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* User Note Input */}
                <textarea
                  value={bugDescription}
                  onChange={(e) => setBugDescription(e.target.value)}
                  placeholder="תאר בקצרה מה קרה בתקלה..."
                  rows={2}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    borderRadius: '8px',
                    border: '1px solid #fda4af',
                    padding: '6px 8px',
                    fontSize: '0.76rem',
                    fontFamily: 'inherit',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Pinned Bottom Action Bar (Always visible, never clipped!) */}
              <div style={{ padding: '7px 12px', background: '#ffe4e6', borderTop: '1px solid #fecdd3', display: 'flex', flexDirection: 'column', gap: '5px', flexShrink: 0 }}>
                {isUploadingBugReport && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.69rem', fontWeight: 800, color: '#be123c' }}>
                      <span>☁️ מעלה חבילת דיווח לענן...</span>
                      <span>{bugUploadProgress}%</span>
                    </div>
                    <div style={{ height: '5px', background: '#fecdd3', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${bugUploadProgress}%`, height: '100%', background: '#e11d48', transition: 'width 0.15s ease' }} />
                    </div>
                  </div>
                )}

                {bugSentSuccess ? (
                  <div style={{ background: '#dcfce7', color: '#166534', padding: '6px', borderRadius: '8px', textAlign: 'center', fontWeight: 800, fontSize: '0.76rem' }}>
                    ✅ הדיווח נשלח בהצלחה למנהל המערכת עם כל הפרטים!
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isUploadingBugReport}
                    onClick={handleSubmitBugReport}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #be123c, #e11d48)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '9px',
                      padding: '8px 12px',
                      fontSize: '0.80rem',
                      fontWeight: 900,
                      cursor: isUploadingBugReport ? 'wait' : 'pointer',
                      boxShadow: '0 4px 10px rgba(225, 29, 72, 0.25)'
                    }}
                  >
                    🚀 שלח חבילת תקלה לאדמין
                  </button>
                )}
              </div>
              </>
              )}
            </div>
          )}

          {/* Messages Container (Only rendered when Bug Composer is NOT open) */}
          {!isBugComposerOpen && (
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                background: '#f8fafc'
              }}
            >
            {messages.map(m => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.sender === 'user' ? 'flex-start' : 'flex-end',
                  maxWidth: '85%',
                  background: m.sender === 'user' ? '#4f46e5' : '#ffffff',
                  color: m.sender === 'user' ? '#ffffff' : '#1e293b',
                  padding: '9px 12px',
                  borderRadius: m.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  fontSize: '0.82rem',
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap'
                }}
              >
                {m.text}

                {/* Automatic Bug Detection Action Card inside the Assistant Reply */}
                {m.sender === 'assistant' && m.isBugIntent && (
                  <div
                    style={{
                      marginTop: '9px',
                      padding: '8px 10px',
                      background: '#fff1f2',
                      border: '1px solid #fecdd3',
                      borderRadius: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ fontSize: '0.73rem', fontWeight: 800, color: '#9f1239' }}>
                      🛠️ זיהיתי שנתקלת בתקלה! רוצה לשלוח אותה לטיפול האדמין?
                    </div>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleTakeBugScreenshot(m.queryText)}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #f43f5e',
                          color: '#be123c',
                          borderRadius: '7px',
                          padding: '4px 8px',
                          fontSize: '0.71rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        📸 צלם מסך
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartBugVideoRecording(m.queryText)}
                        style={{
                          background: '#e11d48',
                          border: 'none',
                          color: '#ffffff',
                          borderRadius: '7px',
                          padding: '4px 8px',
                          fontSize: '0.71rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        🎥 הקלט סרטון (00:{BUG_VIDEO_MAX_SECONDS})
                      </button>
                      <button
                        type="button"
                        onClick={() => openBugComposerWithDefaultNote(m.queryText)}
                        style={{
                          background: '#ffe4e6',
                          border: '1px solid #fda4af',
                          color: '#9f1239',
                          borderRadius: '7px',
                          padding: '4px 8px',
                          fontSize: '0.71rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        📩 פתח דיווח
                      </button>
                    </div>
                  </div>
                )}

                {/* Follow-up suggestions from connected neural edges */}
                {m.sender === 'assistant' && m.followUps && m.followUps.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {m.followUps.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => sendMessage(q)}
                        style={{
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: '10px',
                          padding: '3px 8px',
                          fontSize: '0.73rem',
                          color: '#334155',
                          cursor: 'pointer',
                          textAlign: 'right'
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {/* Speak + AI Source Indicator + Helpful/Not-Helpful feedback on assistant answers */}
                {m.sender === 'assistant' && (
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => speakText(m.text)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          color: '#6366f1',
                          padding: 0,
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                        title="הקרא תשובה בקול"
                      >
                        {isAudioLoading ? '⏳ טוען שמע...' : isSpeaking ? '🔊 מקריא...' : '🔊 הקרא'}
                      </button>
                      {m.source && (
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '6px',
                          background: m.source === 'cloud_llm' ? '#ecfdf5' : '#fffbeb',
                          color: m.source === 'cloud_llm' ? '#047857' : '#b45309',
                          border: `1px solid ${m.source === 'cloud_llm' ? '#a7f3d0' : '#fde68a'}`
                        }}>
                          {m.source === 'cloud_llm' ? '✨ AI חכם' : `🧠 מקומי (${m.fallbackReason || 'fallback'})`}
                        </span>
                      )}
                    </div>

                    {m.id !== 'welcome' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {m.feedback ? (
                          <span style={{ fontSize: '0.72rem', color: m.feedback === 'helpful' ? '#16a34a' : '#d97706', fontWeight: 600 }}>
                            {m.feedback === 'helpful' ? '✓ תודה, עזר!' : '✓ נרשם לשיפור'}
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => submitFeedback(m.id, 'helpful')}
                              title="התשובה עזרה לי"
                              style={{
                                background: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                borderRadius: '8px',
                                padding: '2px 7px',
                                fontSize: '0.72rem',
                                color: '#15803d',
                                cursor: 'pointer'
                              }}
                            >
                              👍 עזר
                            </button>
                            <button
                              type="button"
                              onClick={() => submitFeedback(m.id, 'not_helpful')}
                              title="התשובה לא הייתה מדויקת"
                              style={{
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '8px',
                                padding: '2px 7px',
                                fontSize: '0.72rem',
                                color: '#b91c1c',
                                cursor: 'pointer'
                              }}
                            >
                              👎 לא מדויק
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
            </div>
          )}

          {/* Suggested Context-Aware Questions (Only shown when not composing a bug report) */}
          {!isBugComposerOpen && suggestedQuestions.length > 0 && (
            <div
              style={{
                padding: '6px 12px',
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                gap: '6px',
                overflowX: 'auto',
                whiteSpace: 'nowrap'
              }}
            >
              {suggestedQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(q)}
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1d4ed8',
                    padding: '3px 9px',
                    borderRadius: '8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  💡 {q}
                </button>
              ))}
            </div>
          )}

          {/* Input & Voice Controls (Only shown when not composing a bug report) */}
          {!isBugComposerOpen && (
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSend();
              }}
              style={{
                padding: '10px',
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                gap: '6px',
                alignItems: 'center'
              }}
            >
              {/* Voice Dictation (Speech to Text) */}
              <button
                type="button"
                onClick={handleToggleVoiceInput}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: isListening ? '2px solid #ef4444' : '1px solid #cbd5e1',
                  background: isListening ? '#fee2e2' : '#f8fafc',
                  color: isListening ? '#ef4444' : '#475569',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: isListening ? 'pulse 1.2s infinite' : 'none'
                }}
                title={isListening ? 'מקליט... לחץ לסיום' : 'הקלט הוראה בדיבור 🎙️'}
              >
                🎙️
              </button>

              <input
                type="text"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                placeholder={isListening ? '🎙️ מאזין לך... דבר עכשיו' : 'שאל משהו בקול או בהקלדה...'}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: isListening ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  direction: 'rtl'
                }}
              />

              <button
                type="submit"
                disabled={!inputVal.trim()}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: 'none',
                  background: inputVal.trim() ? '#4f46e5' : '#e2e8f0',
                  color: inputVal.trim() ? '#ffffff' : '#94a3b8',
                  cursor: inputVal.trim() ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.95rem'
                }}
              >
                ➤
              </button>
            </form>
          )}
        </div>
        );
      })()}
    </>
  );
};

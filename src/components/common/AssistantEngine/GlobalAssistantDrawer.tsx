'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAssistant } from './AssistantContext';
import { APP_VERSION } from '@/constants/version';

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
    speakText,
    stopSpeaking,
    clearChat
  } = useAssistant();

  const [inputVal, setInputVal] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  // Speech-to-Text via Web Speech API
  const handleToggleVoiceInput = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('דפדפן זה אינו תומך בזיהוי קולי ישיר. אנא השתמש בהקלדה.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'he-IL';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setInputVal(prev => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputVal).trim();
    if (!text) return;
    setInputVal('');
    await sendMessage(text);
  };

  return (
    <>
      {/* FLOATING ACTION ORB (Draggable, always available across all screens) */}
      <div
        onPointerDown={handlePointerDown}
        style={{
          position: 'fixed',
          left: position ? `${position.x}px` : 'auto',
          top: position ? `${position.y}px` : 'auto',
          right: position ? 'auto' : '24px',
          bottom: position ? 'auto' : '150px',
          zIndex: 99999,
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

      {/* ASSISTANT SLIDE-OVER DRAWER */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            left: position ? Math.min(Math.max(10, position.x - 320), window.innerWidth - 380) : 'auto',
            top: position ? Math.min(Math.max(10, position.y - 530), window.innerHeight - 540) : 'auto',
            bottom: position ? 'auto' : '88px',
            right: position ? 'auto' : '24px',
            width: 'calc(100vw - 48px)',
            maxWidth: '380px',
            height: '520px',
            maxHeight: 'calc(100vh - 120px)',
            background: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 20px 45px rgba(0,0,0,0.22)',
            border: '1.5px solid #e2e8f0',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            direction: 'rtl',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.3rem' }}>🤖</span>
              <div>
                <div style={{ fontWeight: 900, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>עוזר אישי SmartShare</span>
                  <span style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.25)', padding: '1px 6px', borderRadius: '6px' }}>
                    {APP_VERSION}
                  </span>
                </div>
                <div style={{ fontSize: '0.68rem', opacity: 0.9 }}>
                  {screenContext.activeWidget === 'fileshare' ? '📁 מודע לפורטל שיתוף קבצים' : '🌐 מודע לכלל המערכת'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isSpeaking && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    cursor: 'pointer'
                  }}
                  title="הפסק הקראה"
                >
                  🔊 עצור
                </button>
              )}
              <button
                type="button"
                onClick={clearChat}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  opacity: 0.8
                }}
                title="אפס שיחה"
              >
                🔄
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  padding: '0 4px'
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Context Banner */}
          <div style={{ padding: '6px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📍</span>
            <span>מיקום נוכחי: {screenContext.spaceTitle ? `מרחב "${screenContext.spaceTitle}"` : 'דף ראשי'}</span>
          </div>

          {/* Messages Container */}
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

                {/* Speak + Helpful/Not-Helpful feedback on assistant answers */}
                {m.sender === 'assistant' && (
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => speakText(m.text)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        color: '#6366f1',
                        padding: 0
                      }}
                      title="הקרא תשובה בקול"
                    >
                      🔊 הקרא
                    </button>

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

          {/* Suggested Context-Aware Questions */}
          {suggestedQuestions.length > 0 && (
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

          {/* Input & Voice Controls */}
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
              placeholder="שאל משהו בקול או בהקלדה..."
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
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
        </div>
      )}
    </>
  );
};

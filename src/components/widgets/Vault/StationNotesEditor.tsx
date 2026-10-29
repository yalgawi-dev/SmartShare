'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface StationNotesEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

// Preset color options for text
const TEXT_COLORS = [
  { label: 'שחור כהה', color: '#1e293b' },
  { label: 'כחול עמוק', color: '#1d4ed8' },
  { label: 'אדום יין', color: '#b91c1c' },
  { label: 'ירוק יער', color: '#15803d' },
  { label: 'סגול רויאל', color: '#7e22ce' }
];

// Highlighter marker colors (טושים זוהרים)
const HIGHLIGHT_COLORS = [
  { label: 'מרקר צהוב זוהר', color: '#fef08a' },
  { label: 'מרקר ירוק זוהר', color: '#bbf7d0' },
  { label: 'מרקר ורוד זוהר', color: '#fbcfe8' },
  { label: 'מרקר תכלת זוהר', color: '#a5f3fc' },
  { label: 'מרקר כתום זוהר', color: '#fed7aa' }
];

// Quick templates chips
const QUICK_CHIPS = [
  { label: '📋 סיכום פגישה', snippet: '<div><strong>📋 סיכום פגישה:</strong></div><div>• </div>' },
  { label: '⚖️ החלטות שנתקבלו', snippet: '<div><strong>⚖️ החלטות שהתקבלו:</strong></div><div>1. </div>' },
  { label: '🔍 דגשים לבדיקה', snippet: '<div><strong>🔍 דגשים לבדיקה:</strong></div><div>• </div>' },
  { label: '⚠️ נקודה דחופה', snippet: '<div><span style="background-color: #fef08a; font-weight: bold; padding: 2px 6px; border-radius: 4px;">⚠️ דחוף לטיפול:</span> </div>' },
  { label: '• רשימת נקודות', snippet: '<div>• סעיף א: </div><div>• סעיף ב: </div>' }
];

export default function StationNotesEditor({
  value,
  onChange,
  placeholder = 'מה סוכם? דגשים, הערות, החלטות או סיכום...',
  minHeight = '140px'
}: StationNotesEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlighterPicker, setShowHighlighterPicker] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Sync incoming value to editor content if changed externally
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      if (!editorRef.current.contains(document.activeElement)) {
        editorRef.current.innerHTML = value || '';
      }
    }
  }, [value]);

  // Setup Web Speech API for Hebrew Speech-to-Text
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'he-IL';

        recognition.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              const text = event.results[i][0].transcript.trim();
              if (text) {
                insertTextAtCursor(text + ' ');
              }
            }
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('Speech recognition error:', e.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) {
      alert('זיהוי קולי אינו נתמך בדפדפן זה. מומלץ להשתמש ב-Google Chrome או Safari.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        if (editorRef.current) {
          editorRef.current.focus();
        }
      } catch (err) {
        console.error('Failed to start speech recognition', err);
        setIsListening(false);
      }
    }
  };

  const executeCommand = (command: string, arg: string | undefined = undefined) => {
    if (typeof document === 'undefined') return;
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, arg);
    handleInput();
  };

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      if (html === '<br>' || html === '<div><br></div>' || !html.trim()) {
        onChange('');
      } else {
        onChange(html);
      }
    }
  };

  const insertTextAtCursor = (text: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertText', false, text);
    handleInput();
  };

  const insertHtmlSnippet = (snippetHtml: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertHTML', false, snippetHtml);
    handleInput();
  };

  const applyHighlight = (color: string) => {
    if (typeof document === 'undefined') return;
    if (editorRef.current) editorRef.current.focus();
    document.execCommand('hiliteColor', false, color);
    setShowHighlighterPicker(false);
    handleInput();
  };

  const applyTextColor = (color: string) => {
    if (typeof document === 'undefined') return;
    if (editorRef.current) editorRef.current.focus();
    document.execCommand('foreColor', false, color);
    setShowColorPicker(false);
    handleInput();
  };

  const applyFontSize = (sizeStr: string) => {
    executeCommand('fontSize', sizeStr);
  };

  const editorContainer = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: '#ffffff',
      border: '1.5px solid #cbd5e1',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: isExpanded ? '0 25px 50px -12px rgba(0, 0, 0, 0.25)' : '0 1px 3px rgba(0,0,0,0.05)',
      transition: 'all 0.2s ease',
      height: isExpanded ? '100%' : 'auto',
      maxHeight: isExpanded ? '100%' : 'none'
    }}>
      {/* TOOLBAR */}
      <div style={{
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        padding: '0.4rem 0.6rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.4rem'
      }}>
        {/* Left Toolbar (Formatting) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
          {/* Bold */}
          <button
            type="button"
            onClick={() => executeCommand('bold')}
            title="הדגשה (Bold)"
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              width: '32px',
              height: '30px',
              fontWeight: '900',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1e293b'
            }}
          >
            B
          </button>

          {/* Underline */}
          <button
            type="button"
            onClick={() => executeCommand('underline')}
            title="קו תחתי"
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              width: '32px',
              height: '30px',
              textDecoration: 'underline',
              fontWeight: 'bold',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1e293b'
            }}
          >
            U
          </button>

          {/* Font Sizes */}
          <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', background: 'white' }}>
            <button
              type="button"
              onClick={() => applyFontSize('2')}
              title="גודל כתב קטן"
              style={{ background: 'transparent', border: 'none', borderLeft: '1px solid #e2e8f0', padding: '0 6px', height: '30px', fontSize: '0.75rem', cursor: 'pointer', color: '#475569' }}
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => applyFontSize('3')}
              title="גודל כתב רגיל"
              style={{ background: 'transparent', border: 'none', borderLeft: '1px solid #e2e8f0', padding: '0 6px', height: '30px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', color: '#1e293b' }}
            >
              A
            </button>
            <button
              type="button"
              onClick={() => applyFontSize('5')}
              title="גודל כתב מוגדל"
              style={{ background: 'transparent', border: 'none', padding: '0 6px', height: '30px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', color: '#1e293b' }}
            >
              A+
            </button>
          </div>

          {/* Text Color Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => { setShowColorPicker(!showColorPicker); setShowHighlighterPicker(false); }}
              title="מניפת צבעי טקסט"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                height: '30px',
                padding: '0 8px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: '#1e293b'
              }}
            >
              <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: 'linear-gradient(135deg, #ef4444, #3b82f6, #10b981)' }}></span>
              <span>צבע</span>
            </button>
            {showColorPicker && (
              <div style={{
                position: 'absolute',
                top: '36px',
                right: 0,
                background: 'white',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '6px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                zIndex: 50,
                display: 'flex',
                gap: '6px'
              }}>
                {TEXT_COLORS.map(c => (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() => applyTextColor(c.color)}
                    title={c.label}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: c.color,
                      border: '2px solid white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Highlighter (טוש זוהר) */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => { setShowHighlighterPicker(!showHighlighterPicker); setShowColorPicker(false); }}
              title="טוש זוהר (מרקר הדגשה)"
              style={{
                background: '#fef9c3',
                border: '1px solid #fde047',
                borderRadius: '8px',
                height: '30px',
                padding: '0 8px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: '#854d0e'
              }}
            >
              <span>🖍️</span>
              <span>מרקר</span>
            </button>
            {showHighlighterPicker && (
              <div style={{
                position: 'absolute',
                top: '36px',
                right: 0,
                background: 'white',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '8px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold' }}>בחר צבע טוש זוהר:</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {HIGHLIGHT_COLORS.map(c => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => applyHighlight(c.color)}
                      title={c.label}
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        background: c.color,
                        border: '1px solid rgba(0,0,0,0.15)',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => applyHighlight('transparent')}
                    title="נקה מרקר"
                    style={{
                      height: '26px',
                      padding: '0 6px',
                      borderRadius: '6px',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      color: '#64748b'
                    }}
                  >
                    נקה
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Toolbar: Speech Dictation & Fullscreen Focus */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          {/* Speech-to-Text Button (🎙️ דיקטפון) */}
          <button
            type="button"
            onClick={toggleListening}
            title={isListening ? 'עצור הקלטה קולית' : 'הכתבה קולית בעברית (דיקטפון)'}
            style={{
              background: isListening ? '#fee2e2' : '#f0fdf4',
              border: `1.5px solid ${isListening ? '#ef4444' : '#86efac'}`,
              borderRadius: '10px',
              height: '30px',
              padding: '0 8px',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: isListening ? '#dc2626' : '#166534'
            }}
          >
            <span>{isListening ? '🔴' : '🎙️'}</span>
            <span>{isListening ? 'מקליט...' : 'דיקטפון'}</span>
          </button>

          {/* Fullscreen Expand / Collapse */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'צמצם תצוגה' : 'הרחב למסך מלא (כתיבה נוחה וממוקדת)'}
            style={{
              background: isExpanded ? '#eff6ff' : '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              width: '32px',
              height: '30px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem',
              color: '#3b82f6'
            }}
          >
            ⛶
          </button>
        </div>
      </div>

      {/* QUICK TEMPLATE CHIPS BAR */}
      <div style={{
        background: '#f1f5f9',
        padding: '0.3rem 0.6rem',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        overflowX: 'auto',
        whiteSpace: 'nowrap'
      }}>
        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold' }}>תבניות מהירות:</span>
        {QUICK_CHIPS.map(chip => (
          <button
            key={chip.label}
            type="button"
            onClick={() => insertHtmlSnippet(chip.snippet)}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '0.72rem',
              cursor: 'pointer',
              color: '#334155',
              flexShrink: 0,
              transition: 'background 0.15s'
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* RICH CONTENT EDITABLE AREA */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        style={{
          minHeight: isExpanded ? 'calc(100vh - 250px)' : minHeight,
          maxHeight: isExpanded ? 'none' : '350px',
          overflowY: 'auto',
          padding: '0.85rem 1rem',
          outline: 'none',
          fontSize: '0.95rem',
          lineHeight: '1.6',
          color: '#1e293b',
          direction: 'rtl',
          textAlign: 'right',
          flex: 1
        }}
      />

      {/* Bottom Info Bar */}
      <div style={{
        background: '#fafafa',
        borderTop: '1px solid #f1f5f9',
        padding: '0.25rem 0.75rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.7rem',
        color: '#94a3b8'
      }}>
        <span>טקסט עשיר • מרקרים זוהרים • הקלטה קולית</span>
        {isListening && (
          <span style={{ color: '#ef4444', fontWeight: 'bold' }}>🎙️ מדבר כעת... הטקסט מוזן אוטומטית בעברית</span>
        )}
      </div>
    </div>
  );

  if (isExpanded) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100005,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem'
      }}>
        <div style={{ width: '100%', maxWidth: '850px', height: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', color: 'white' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>📝 כתיבת סיכום והערות לתחנה (מסך מלא)</div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '1.1rem' }}
            >
              ✕
            </button>
          </div>
          {editorContainer}
        </div>
      </div>
    );
  }

  return editorContainer;
}

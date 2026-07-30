import React from 'react';

export const SVG_ELEMENTS: Record<string, React.FC<{ color?: string, size?: number }>> = {
  bear: ({ color = '#000', size = 64 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 5a2 2 0 0 0-4 0M4 14a2 2 0 0 1-2-2 2 2 0 0 1 2-2M20 14a2 2 0 0 0 2-2 2 2 0 0 0-2-2"/>
      <path d="M12 21a9 9 0 0 0 9-9c0-3.5-2.5-6.5-6-7.5-1-.3-2-.5-3-.5s-2 .2-3 .5C5.5 5.5 3 8.5 3 12a9 9 0 0 0 9 9z"/>
      <path d="M15 14c0 1.5-1.5 3-3 3s-3-1.5-3-3"/>
      <path d="M9 10h.01M15 10h.01"/>
    </svg>
  ),
  leaf: ({ color = '#000', size = 64 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
      <path d="M2 22 12 12"/>
    </svg>
  ),
  flower: ({ color = '#000', size = 64 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5"/>
      <path d="M12 22v-5.5"/>
    </svg>
  ),
  star: ({ color = '#000', size = 64 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  heart: ({ color = '#000', size = 64 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
    </svg>
  ),
  sparkles: ({ color = '#000', size = 64 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4M3 5h4"/>
    </svg>
  ),
  party: ({ color = '#000', size = 64 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.8 11.3 2 22l10.7-3.79"/>
      <path d="M4 3h.01M22 8h.01M15 2h.01M22 20h.01M22 2l-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/>
      <path d="m22 13-.82-.33c-.86-.39-1.67.14-1.92 1.07v0c-.26.96-1.32 1.4-2.22.95l-.65-.32"/>
      <path d="m11 22 .33-.82c.39-.86-.14-1.67-1.07-1.92v0c-.96-.26-1.4-1.32-.95-2.22l.32-.65"/>
      <path d="m11 5 6 6"/>
    </svg>
  ),
  sun: ({ color = '#000', size = 64 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  ),
  moon: ({ color = '#000', size = 64 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
    </svg>
  ),
  cloud: ({ color = '#000', size = 64 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
    </svg>
  ),
  music: ({ color = '#000', size = 64 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
    </svg>
  ),
  crown: ({ color = '#000', size = 64 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4l3 11h14l3-11-5 4-5-6-5 6z"/>
    </svg>
  ),
  cat: ({ color = '#000', size = 64 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3.1-9-7.56c0-1.25.5-2.4 1.1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z"/><path d="M8 14v.5M16 14v.5M11.25 16.25h1.5L12 17l-.75-.75Z"/>
    </svg>
  ),
  dog: ({ color = '#000', size = 64 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.7.54 6.626 3.125 7.11 2.056.384 3.148-1.55 3.535-2.11M14 5.172C14 3.782 15.577 2.679 17.5 3c2.823.47 4.113 6.006 4 7-.08.7-.54 6.626-3.125 7.11-2.056.384-3.148-1.55-3.535-2.11"/><path d="M7.4 11.5V11M16.6 11.5V11M10.5 15.5h3L12 17l-1.5-1.5Z"/>
    </svg>
  ),
  tree: ({ color = '#000', size = 64 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-9M12 3a5 5 0 0 0-5 5c0 1.5.5 3 1.5 4-1 .5-2 1.5-2 3 0 1.5 1.5 3 3 3h5M12 3a5 5 0 0 1 5 5c0 1.5-.5 3-1.5 4 1 .5 2 1.5 2 3 0 1.5-1.5 3-3 3h-5"/>
    </svg>
  ),
  cake: ({ color = '#000', size = 64 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2z"/><path d="M2 13v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3"/><path d="M12 8V4M12 4c.5-1 1.5-1 2-1M8 8V4M8 4c.5-1 1.5-1 2-1M16 8V4M16 4c.5-1 1.5-1 2-1"/>
    </svg>
  ),
  gift: ({ color = '#000', size = 64 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12"/><rect width="20" height="5" x="2" y="7"/><line x1="12" x2="12" y1="22" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
    </svg>
  )
};

export function renderSticker(stickerId: string, size = 64) {
  try {
    if (stickerId.startsWith('{')) {
      const parsed = JSON.parse(stickerId);
      if (parsed.type === 'svg' && SVG_ELEMENTS[parsed.name]) {
        const SvgComponent = SVG_ELEMENTS[parsed.name];
        return <SvgComponent color={parsed.color} size={size} />;
      }
    }
  } catch (e) {
    // Not JSON, just return text
  }
  return stickerId;
}

'use client';

import React, { useState } from 'react';
import { APP_VERSION } from '@/constants/version';
import { forceAppUpdate } from '@/utils/versionUtils';

interface VersionBadgeProps {
  version?: string;
  style?: React.CSSProperties;
  className?: string;
  showReloadPrompt?: boolean;
}

export default function VersionBadge({
  version = APP_VERSION,
  style,
  className,
  showReloadPrompt = true,
}: VersionBadgeProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showReloadPrompt) return;

    if (window.confirm(`גרסה נוכחית: ${version}\nהאם ברצונך לבצע רענון עמוק וניקוי זיכרון מטמון למשיכת הגרסה העדכנית ביותר?`)) {
      setIsUpdating(true);
      await forceAppUpdate();
    }
  };

  return (
    <span
      onClick={handleClick}
      title={showReloadPrompt ? 'לחץ לרענון עמוק ומשיכת הגרסה החדשה' : undefined}
      className={className}
      style={{
        fontSize: '0.65rem',
        background: isUpdating ? '#fef08a' : '#e0e7ff',
        color: isUpdating ? '#854d0e' : '#4338ca',
        padding: '2px 8px',
        borderRadius: '10px',
        fontWeight: 'bold',
        cursor: showReloadPrompt ? 'pointer' : 'default',
        userSelect: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        transition: 'all 0.2s ease',
        ...style,
      }}
    >
      {isUpdating ? '⏳ מרענן...' : version}
    </span>
  );
}

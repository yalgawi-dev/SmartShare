'use client';

import React, { useEffect, useRef } from 'react';
import { OTP_AUTO_VERIFY, OTP_LENGTH, sanitizeOtp } from './otpPolicy';
import SmsSpamHint from './SmsSpamHint';

interface OtpCodeFieldProps {
  value: string;
  onChange: (code: string) => void;
  /** Called only when OTP_AUTO_VERIFY is enabled and a full code was entered. */
  onComplete?: (code: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  inputId: string;
  inputStyle?: React.CSSProperties;
  inputClassName?: string;
  /** Rendered between the field and the spam hint (e.g. the error box). */
  children?: React.ReactNode;
}

/**
 * Shared OTP input used by every phone-auth flow.
 * - Keyboard / Google autofill (autocomplete="one-time-code") fills the field natively.
 * - Clipboard paste never auto-verifies and refuses codes that were already rejected.
 * - Re-focuses the field when the user returns from the Messages app so the
 *   keyboard autofill suggestion has a target.
 */
export default function OtpCodeField({
  value, onChange, onComplete, onError, disabled, inputId, inputStyle, inputClassName, children
}: OtpCodeFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const focusIfEmpty = () => {
      if (document.visibilityState === 'visible' && !valueRef.current) {
        setTimeout(() => inputRef.current?.focus(), 150);
      }
    };
    focusIfEmpty();
    document.addEventListener('visibilitychange', focusIfEmpty);
    window.addEventListener('focus', focusIfEmpty);
    return () => {
      document.removeEventListener('visibilitychange', focusIfEmpty);
      window.removeEventListener('focus', focusIfEmpty);
    };
  }, []);

  const handleTyped = (raw: string) => {
    const code = sanitizeOtp(raw);
    onChange(code);
    if (OTP_AUTO_VERIFY && code.length === OTP_LENGTH) onComplete?.(code);
  };

  return (
    <>
      <div dir="ltr" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%' }}>
        <input
          ref={inputRef}
          id={inputId}
          name="one-time-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={OTP_LENGTH}
          value={value}
          onChange={(e) => handleTyped(e.target.value)}
          placeholder="000000"
          disabled={disabled}
          className={inputClassName}
          style={inputStyle}
        />
      </div>
      {children}
      <SmsSpamHint />
    </>
  );
}

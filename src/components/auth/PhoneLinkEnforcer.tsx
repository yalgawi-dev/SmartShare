'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../app/context/AuthContext';
import { auth, db } from '@/lib/firebase';
import { RecaptchaVerifier, linkWithCredential, PhoneAuthProvider } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function PhoneLinkEnforcer() {
  const { user, isLoaded, updateProfile } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  // Web OTP API: Auto-read and auto-fill SMS code directly from Android / Chrome
  useEffect(() => {
    if (step !== 2 || typeof window === 'undefined') return;

    let abortController: AbortController | null = null;
    if ('OTPCredential' in window || (navigator as any).credentials) {
      try {
        abortController = new AbortController();
        (navigator as any).credentials.get({
          otp: { transport: ['sms'] },
          signal: abortController.signal
        }).then((otpCredential: any) => {
          if (otpCredential && otpCredential.code) {
            const extractedCode = String(otpCredential.code).trim();
            const digitsOnly = extractedCode.replace(/\D/g, '').slice(0, 6);
            if (digitsOnly.length === 6) {
              handleOtpChange(digitsOnly);

              if (otpInputRef.current) {
                try {
                  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype,
                    'value'
                  )?.set;
                  if (nativeInputValueSetter) {
                    nativeInputValueSetter.call(otpInputRef.current, digitsOnly);
                  } else {
                    otpInputRef.current.value = digitsOnly;
                  }
                  otpInputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
                } catch (domErr) {
                  console.warn('DOM sync fallback notice:', domErr);
                }
              }

              setErrorMsg('');
              setTimeout(() => {
                verifyCode(digitsOnly);
              }, 80);
            }
          }
        }).catch((err: any) => {
          if (err.name !== 'AbortError') {
            console.warn('WebOTP auto-read notice:', err);
          }
        });
      } catch (e) {
        // Fallback silently if not supported
      }
    }

    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [step]);

  useEffect(() => {
    // Check if user dismissed the phone prompt in this session
    if (typeof window !== 'undefined') {
      const dismissed = sessionStorage.getItem('phone_link_postponed');
      if (dismissed === 'true') {
        setIsDismissed(true);
      }
    }
  }, []);

  const initRecaptcha = () => {
    if (typeof window === 'undefined') return;
    try {
      if ((window as any).recaptchaVerifierLink) {
        try {
          (window as any).recaptchaVerifierLink.clear();
        } catch (e) {}
        (window as any).recaptchaVerifierLink = null;
      }
      const el = document.getElementById('recaptcha-container-link');
      if (el) el.innerHTML = '';

      (window as any).recaptchaVerifierLink = new RecaptchaVerifier(auth, 'recaptcha-container-link', {
        size: 'invisible',
        callback: () => {},
        'expired-callback': () => {
          initRecaptcha();
        }
      });
      (window as any).recaptchaVerifierLink.render();
    } catch (e) {
      console.error('Recaptcha error:', e);
    }
  };

  useEffect(() => {
    if (!user || user.phone || isDismissed) return;
    initRecaptcha();
    return () => {
      if (typeof window !== 'undefined' && (window as any).recaptchaVerifierLink) {
        try {
          (window as any).recaptchaVerifierLink.clear();
          (window as any).recaptchaVerifierLink = null;
        } catch (e) {}
      }
    };
  }, [user?.id, isDismissed]);

  if (!isLoaded || !user || isDismissed) return null;
  // If user already has a phone (verified or unverified saved) or is anonymous / admin, don't block
  if (user.phone || (user as any).isAnonymous || user.isAdmin) return null;

  const handleSendCode = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 9 || cleanPhone.length > 10) {
      setErrorMsg('יש להזין מספר טלפון חוקי בן 9-10 ספרות');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const formattedPhone = `+972${cleanPhone.replace(/^0/, '')}`;
      let appVerifier = (window as any).recaptchaVerifierLink;
      if (!appVerifier) {
        initRecaptcha();
        appVerifier = (window as any).recaptchaVerifierLink;
      }

      if (!appVerifier) {
        throw new Error('אימות האבטחה אינו מוכן');
      }

      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber(formattedPhone, appVerifier);
      setConfirmationResult(verificationId);
      setStep(2);
      setIsSubmitting(false);
      setTimeout(() => otpInputRef.current?.focus(), 150);
    } catch (error: any) {
      console.error('Phone link error:', error);
      setIsSubmitting(false);
      initRecaptcha();
      const code = error.code || '';
      if (code === 'auth/too-many-requests') {
        setErrorMsg('יותר מדי ניסיונות. שרת Google הגביל זמנית שליחת SMS למספר זה.');
      } else if (code === 'auth/quota-exceeded') {
        setErrorMsg('מכסת הודעות ה-SMS היומית של המערכת הסתיימה.');
      } else if (code === 'auth/invalid-phone-number') {
        setErrorMsg('מספר הטלפון שהוזן אינו חוקי.');
      } else {
        setErrorMsg('לא הצלחנו לשלוח קוד SMS כרגע. באפשרותך לשמור את המספר ולהמשיך לאפליקציה.');
      }
    }
  };

  const handleOtpChange = (value: string, shouldAutoVerify: boolean = true) => {
    setErrorMsg('');
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setOtpValue(digitsOnly);
    if (shouldAutoVerify && digitsOnly.length === 6) {
      setTimeout(() => {
        verifyCode(digitsOnly);
      }, 50);
    }
  };

  const verifyCode = async (directCode?: string) => {
    const code = (typeof directCode === 'string' ? directCode : otpValue).trim();
    if (code.length !== 6) {
      setErrorMsg('הזן קוד בן 6 ספרות');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const formattedPhone = `+972${cleanPhone.replace(/^0/, '')}`;
      const credential = PhoneAuthProvider.credential(confirmationResult, code);

      if (auth.currentUser) {
        try {
          await linkWithCredential(auth.currentUser, credential);
        } catch (linkError: any) {
          if (linkError.code === 'auth/credential-already-in-use') {
            setErrorMsg('מספר הטלפון הזה כבר מקושר לחשבון אחר במערכת.');
            setIsSubmitting(false);
            return;
          }
          console.warn('Link credential warning:', linkError);
        }
      }

      await updateProfile({ phone: formattedPhone, phoneVerified: true });
      await setDoc(doc(db, 'users', user.id), { phone: formattedPhone, phoneVerified: true }, { merge: true });
    } catch (error: any) {
      console.error(error);
      setIsSubmitting(false);
      setErrorMsg('קוד האימות שגוי או שפג תוקפו.');
    }
  };

  // Graceful Fallback: Save number as unverified and continue into the app!
  const handleSaveUnverifiedAndContinue = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      setErrorMsg('אנא הזן מספר טלפון תקין כדי שנוכל לשמור אותו בחשבונך');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const formattedPhone = `+972${cleanPhone.replace(/^0/, '')}`;
      await updateProfile({ phone: formattedPhone, phoneVerified: false });
      await setDoc(doc(db, 'users', user.id), { phone: formattedPhone, phoneVerified: false }, { merge: true });
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('phone_link_postponed', 'true');
      }
      setIsDismissed(true);
    } catch (e) {
      console.error('Error saving unverified phone:', e);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('phone_link_postponed', 'true');
      }
      setIsDismissed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostpone = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('phone_link_postponed', 'true');
    }
    setIsDismissed(true);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      backdropFilter: 'blur(8px)',
      direction: 'rtl'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '2rem 1.75rem',
        maxWidth: '430px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
        position: 'relative'
      }}>
        {/* Invisible ReCAPTCHA Container */}
        <div id="recaptcha-container-link" style={{ display: 'none' }}></div>

        <div style={{
          width: '64px',
          height: '64px',
          background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          margin: '0 auto 1.25rem',
          boxShadow: '0 10px 20px -5px rgba(37, 99, 235, 0.4)'
        }}>
          📱
        </div>

        <h2 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontSize: '1.4rem', fontWeight: 800 }}>
          קישור מספר טלפון לחשבונך
        </h2>
        <p style={{ color: '#64748b', marginBottom: '1.25rem', fontSize: '0.92rem', lineHeight: '1.5' }}>
          כדי לחבר את המרחבים וההזמנות שלך ולמנוע כפילויות, מומלץ להזין את מספר הטלפון שלך.
        </p>

        {errorMsg && (
          <div style={{
            background: '#fee2e2',
            color: '#991b1b',
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            marginBottom: '1rem',
            fontSize: '0.88rem',
            fontWeight: 600,
            textAlign: 'right',
            border: '1px solid #fecaca'
          }}>
            {errorMsg}
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', direction: 'ltr' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '0 0.9rem',
                fontWeight: 700,
                color: '#334155',
                fontSize: '0.95rem'
              }}>
                🇮🇱 +972
              </div>
              <input
                type="tel"
                placeholder="050-000-0000"
                value={phone}
                onChange={e => {
                  setErrorMsg('');
                  setPhone(e.target.value.replace(/[^\d-]/g, ''));
                }}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: '0.8rem 1rem',
                  fontSize: '1.1rem',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  direction: 'ltr',
                  fontWeight: 600
                }}
              />
            </div>

            <button
              onClick={handleSendCode}
              disabled={isSubmitting || phone.replace(/\D/g, '').length < 9}
              style={{
                background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                color: 'white',
                border: 'none',
                padding: '0.85rem',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
              }}
            >
              {isSubmitting ? 'שולח SMS...' : 'שלח קוד אימות ב-SMS'}
            </button>

            {/* Fallback button if SMS fails or user prefers saving without waiting */}
            {phone.replace(/\D/g, '').length >= 9 && (
              <button
                type="button"
                onClick={handleSaveUnverifiedAndContinue}
                disabled={isSubmitting}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  padding: '0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                שמור מספר והמשך ללא אימות SMS כעת (אימות בהמשך)
              </button>
            )}

            <button
              type="button"
              onClick={handlePostpone}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.85rem',
                cursor: 'pointer',
                marginTop: '0.25rem',
                textDecoration: 'underline'
              }}
            >
              הזכר לי בפעם הבאה (דלג כעת)
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
              הזן את קוד 6 הספרות שנשלח ל-
              <strong style={{ direction: 'ltr', display: 'inline-block', margin: '0 4px', color: '#1e293b' }}>
                {phone}
              </strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', direction: 'ltr', width: '100%' }}>
              <input
                ref={otpInputRef}
                id="otp-link-input"
                name="otp"
                type="tel"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={otpValue}
                onChange={e => handleOtpChange(e.target.value)}
                onInput={e => handleOtpChange((e.target as HTMLInputElement).value)}
                autoFocus
                placeholder="000000"
                style={{
                  width: '100%',
                  maxWidth: '260px',
                  height: '56px',
                  fontSize: '28px',
                  letterSpacing: '10px',
                  paddingLeft: '10px',
                  textAlign: 'center',
                  border: '2px solid #cbd5e1',
                  borderRadius: '14px',
                  background: '#f8fafc',
                  color: '#0f172a',
                  fontWeight: 800,
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    const match = text.match(/\b(\d{6})\b/) || text.match(/(\d{6})/);
                    if (match && match[1]) {
                      const detected = match[1];
                      handleOtpChange(detected, false);
                      if (otpInputRef.current) {
                        try {
                          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                          if (nativeSetter) nativeSetter.call(otpInputRef.current, detected);
                          else otpInputRef.current.value = detected;
                          otpInputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
                        } catch (e) {}
                      }
                      setErrorMsg('');
                    } else {
                      const digits = text.replace(/\D/g, '').slice(0, 6);
                      if (digits.length === 6) {
                        handleOtpChange(digits, false);
                        if (otpInputRef.current) {
                          try {
                            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                            if (nativeSetter) nativeSetter.call(otpInputRef.current, digits);
                            else otpInputRef.current.value = digits;
                            otpInputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
                          } catch (e) {}
                        }
                        setErrorMsg('');
                      } else {
                        setErrorMsg('לוח ההעתקה אינו מכיל קוד אימות תקין בן 6 ספרות. בדוק אם העתקת את קוד ה-SMS האחרון.');
                      }
                    }
                  } catch {
                    setErrorMsg('לא ניתן לגשת ללוח ההעתקה. אנא הקלד את הקוד ידנית.');
                    otpInputRef.current?.focus();
                  }
                }}
                style={{
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  color: '#1D4ED8',
                  padding: '6px 14px',
                  borderRadius: '10px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  direction: 'rtl'
                }}
              >
                <span>📋</span>
                <span>הדבק קוד מלוח ההעתקה</span>
              </button>
            </div>

            {/* Android / Spam SMS Assistant Notice */}
            <div style={{
              background: '#FFFBEB',
              border: '1px solid #FCD34D',
              borderRadius: '14px',
              padding: '12px 14px',
              textAlign: 'right',
              direction: 'rtl',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: '#B45309', fontSize: '0.92rem' }}>
                <span>📩</span>
                <span>לא קיבלת הודעה? היא מחכה בספאם:</span>
              </div>
              <div style={{ color: '#78350F', fontSize: '0.85rem', lineHeight: '1.5' }}>
                1. פתח את אפליקציית <strong>ההודעות (Messages)</strong> בטלפון.<br/>
                2. לחץ למעלה על <strong>תמונת הפרופיל שלך (העיגול של גוגל)</strong>.<br/>
                3. בחר באפשרות <strong>🛡️ שיחות חסומות וספאם</strong>.<br/>
                4. שם תמצא מיד את הקוד שנשלח!
              </div>
            </div>

            <button
              onClick={() => verifyCode()}
              disabled={isSubmitting || otpValue.length < 6}
              style={{
                background: 'linear-gradient(135deg, #10B981, #059669)',
                color: 'white',
                border: 'none',
                padding: '0.85rem',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              {isSubmitting ? 'מאמת...' : 'אימות וסיום'}
            </button>

            <button
              type="button"
              onClick={handleSaveUnverifiedAndContinue}
              disabled={isSubmitting}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563EB',
                fontSize: '0.88rem',
                fontWeight: 600,
                textDecoration: 'underline',
                cursor: 'pointer'
              }}
            >
              לא קיבלת SMS? שמור מספר זה ואמת במועד מאוחר יותר
            </button>

            <button
              onClick={() => { setStep(1); setErrorMsg(''); }}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              חזור לעריכת המספר
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

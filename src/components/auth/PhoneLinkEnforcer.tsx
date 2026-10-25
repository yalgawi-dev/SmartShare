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
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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
      setTimeout(() => inputRefs.current[0]?.focus(), 150);
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

  const handleOtpChange = (index: number, value: string) => {
    setErrorMsg('');
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const verifyCode = async () => {
    const code = otp.join('');
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

            <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'center', direction: 'ltr' }}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Backspace' && !digit && i > 0) {
                      inputRefs.current[i - 1]?.focus();
                    }
                  }}
                  style={{
                    width: '44px',
                    height: '52px',
                    fontSize: '1.4rem',
                    textAlign: 'center',
                    border: '2px solid #cbd5e1',
                    borderRadius: '12px',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontWeight: 700,
                    outline: 'none'
                  }}
                  disabled={isSubmitting}
                />
              ))}
            </div>

            <button
              onClick={verifyCode}
              disabled={isSubmitting || otp.some(d => !d)}
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

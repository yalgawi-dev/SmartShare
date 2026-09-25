'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../../app/context/AuthContext';

import { auth } from '@/lib/firebase';
import { RecaptchaVerifier, linkWithPhoneNumber, ConfirmationResult } from 'firebase/auth';

export default function PhoneVerificationModal() {
  const { user, linkPhoneNumberMock, isLoaded } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [forceClose, setForceClose] = useState(false);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { 
    setMounted(true); 
  }, []);

  const shouldShow = !forceClose && isLoaded && user && !user.phone && auth.currentUser && !auth.currentUser.isAnonymous;

  useEffect(() => {
    if (mounted && shouldShow) {
      if (typeof window !== 'undefined') {
        try {
          if (!(window as any).recaptchaVerifier) {
            (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
              size: 'normal',
              callback: () => { /* reCAPTCHA solved */ },
              'expired-callback': () => { /* expired */ }
            });
          } else {
            // Render it again if it exists but the DOM node is new
            (window as any).recaptchaVerifier.render();
          }
        } catch (e) {
          console.error("Recaptcha init error:", e);
        }
      }
    }
    
    // Cleanup
    return () => {
      if (typeof window !== 'undefined' && (window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
          (window as any).recaptchaVerifier = null;
        } catch(e) {}
      }
      const container = document.getElementById('recaptcha-container');
      if (container) container.innerHTML = '';
    };
  }, [mounted, shouldShow]);

  if (!mounted || !shouldShow) return null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const val = e.target.value.replace(/[^\d-]/g, '');
    setPhone(val);
  };

  const handleSendCode = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 9 || cleanPhone.length > 10) {
      setErrorMsg('מספר הטלפון שהוזן אינו תקין.');
      return;
    }
    
    // Admin mock bypass
    if (cleanPhone === '0500000000' || cleanPhone === '500000000') {
      setStep(2);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      const appVerifier = (window as any).recaptchaVerifier;
      const formattedPhone = `+972${cleanPhone.replace(/^0/, '')}`;
      const confirmation = await linkWithPhoneNumber(auth.currentUser!, formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      setIsSubmitting(false);
      setStep(2);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (error: any) {
      console.error(error);
      setIsSubmitting(false);
      
      // Handle specific Firebase errors gracefully
      const errCode = error.code || '';
      if (errCode === 'auth/credential-already-in-use') {
        setErrorMsg('מספר טלפון זה כבר משויך לחשבון אחר במערכת.');
      } else if (errCode === 'auth/invalid-phone-number') {
        setErrorMsg('מספר הטלפון אינו תקין. אנא ודא שהקשת נכון.');
      } else if (errCode === 'auth/operation-not-allowed') {
        setErrorMsg('שגיאת הרשאה מ-Firebase. עליך לאפשר את האזור (ישראל) בהגדרות המסוף של גוגל.');
      } else if (errCode === 'auth/too-many-requests') {
        setErrorMsg('יותר מדי ניסיונות. אנא המתן מעט ונסה שוב.');
      } else {
        if (errCode === 'auth/error-code:-39' || error.message.includes('-39')) {
          setErrorMsg('שגיאה 39- (חסימת ספאם): גוגל חסמה זמנית שליחת SMS למספרים אמיתיים עקב יותר מדי ניסיונות. אנא השתמש במספר טסטר (0500000000) או נסה שוב בעוד כמה שעות.');
        } else {
          setErrorMsg('אירוע שגיאה בשליחת הקוד: ' + error.message);
        }
      }
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    setErrorMsg('');

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      setErrorMsg('אנא הכנס קוד בן 6 ספרות.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const formattedPhone = `+972${cleanPhone.replace(/^0/, '')}`;
      
      if (cleanPhone === '0500000000' || cleanPhone === '500000000') {
        if (code !== '123456') { 
          setErrorMsg('הקוד שגוי.');
          setIsSubmitting(false);
          return; 
        }
        await linkPhoneNumberMock(formattedPhone);
      } else {
        if (!confirmationResult) {
          throw new Error('חסר אישור תקשורת. נסה לשלוח שוב.');
        }
        await confirmationResult.confirm(code);
        await linkPhoneNumberMock(formattedPhone);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-verification-code') {
        setErrorMsg('הקוד שהזנת שגוי, נסה שוב.');
      } else if (err.code === 'auth/code-expired') {
        setErrorMsg('הקוד פג תוקף. אנא חזור ובקש קוד חדש.');
      } else {
        setErrorMsg('שגיאה באימות הקוד.');
      }
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <>
      {/* reCAPTCHA Security Widget */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '0.75rem 1rem', display: 'inline-block' }}>
            <div id="recaptcha-container"></div>
          </div>
        </div>
      
      {/* Backdrop */}
      <div 
        style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.45)', 
          backdropFilter: 'blur(4px)',
          zIndex: 999998, 
          animation: 'fadeIn 0.25s ease-out' 
        }} 
      />
      
      {/* Modal */}
      <div 
        style={{ 
          position: 'fixed', top: '50%', left: '50%', 
          transform: 'translate(-50%, -50%)', 
          background: '#ffffff', 
          borderRadius: '24px', 
          width: 'calc(100% - 2rem)', 
          maxWidth: '400px', 
          zIndex: 999999, 
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', 
          display: 'flex', 
          flexDirection: 'column', 
          animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)', 
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' 
        }}
      >
        
        <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
        
        

          
          <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '56px', height: '56px', background: '#F3F4F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111827' }}>
              {step === 1 ? (
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>
              ) : (
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              )}
            </div>
          </div>
          
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem', color: '#111827', fontWeight: '700', letterSpacing: '-0.02em' }}>
            {step === 1 ? 'מה המספר שלך?' : 'הזן את קוד האימות'}
          </h2>
          
          <p style={{ margin: '0 0 1.5rem 0', color: '#6B7280', fontSize: '0.95rem', lineHeight: '1.5' }}>
            {step === 1 
              ? 'אנחנו צריכים לוודא שזה אתה כדי לשמור על החשבון שלך מאובטח.'
              : <span style={{ direction: 'rtl' }}>שלחנו קוד בן 6 ספרות ב-SMS למספר<br/><strong style={{ direction: 'ltr', display: 'inline-block', marginTop: '4px', color: '#111827' }}>+972 {phone.replace(/^0/, '')}</strong></span>}
          </p>

          {errorMsg && (
            <div style={{ color: '#DC2626', fontSize: '0.85rem', marginBottom: '1.25rem', background: '#FEF2F2', border: '1px solid #FCA5A5', padding: '0.75rem', borderRadius: '12px', fontWeight: '500' }}>
              {errorMsg}
            </div>
          )}

          {step === 1 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Premium Input Container */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  background: '#F9FAFB', 
                  border: '1px solid #E5E7EB', 
                  borderRadius: '16px', 
                  padding: '0.5rem 1rem', 
                  direction: 'ltr',
                  transition: 'all 0.2s ease',
                  boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#2563EB';
                  e.currentTarget.style.background = '#FFFFFF';
                  e.currentTarget.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.background = '#F9FAFB';
                  e.currentTarget.style.boxShadow = 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)';
                }}
              >
                <span style={{ fontSize: '1.25rem', marginRight: '0.5rem', userSelect: 'none' }}>🇮🇱</span>
                <span style={{ color: '#4B5563', fontWeight: '600', fontSize: '1.1rem', marginRight: '0.75rem', userSelect: 'none' }}>+972</span>
                <div style={{ width: '1px', height: '24px', background: '#D1D5DB', marginRight: '0.75rem' }}></div>
                <input 
                  type="tel" 
                  placeholder="50 123 4567" 
                  value={phone}
                  onChange={handlePhoneChange}
                  onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                  style={{ 
                    flex: 1, 
                    width: '100%',
                    padding: '0.5rem 0', 
                    border: 'none', 
                    background: 'transparent', 
                    fontSize: '1.15rem', 
                    outline: 'none', 
                    color: '#111827', 
                    fontWeight: '500',
                    letterSpacing: '1px'
                  }}
                  autoFocus
                />
              </div>

              <button 
                onClick={handleSendCode}
                disabled={isSubmitting || phone.replace(/\D/g, '').length < 9}
                style={{ 
                  width: '100%', 
                  background: (isSubmitting || phone.replace(/\D/g, '').length < 9) ? '#93C5FD' : '#2563EB', 
                  color: 'white', 
                  border: 'none', 
                  padding: '1rem', 
                  borderRadius: '16px', 
                  fontSize: '1.05rem', 
                  fontWeight: '600', 
                  cursor: (isSubmitting || phone.replace(/\D/g, '').length < 9) ? 'not-allowed' : 'pointer', 
                  transition: 'background 0.2s',
                  boxShadow: (isSubmitting || phone.replace(/\D/g, '').length < 9) ? 'none' : '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
                }}
              >
                {isSubmitting ? 'מעבד...' : 'המשך'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
              
              {/* WhatsApp-style OTP Boxes */}
              <div style={{ display: 'flex', gap: '0.4rem', direction: 'ltr', justifyContent: 'center', width: '100%' }}>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <input
                    key={index}
                    ref={el => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    value={otp[index]}
                    onChange={e => handleOtpChange(index, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(index, e)}
                    style={{ 
                      width: '2.8rem', 
                      height: '3.5rem', 
                      fontSize: '1.5rem', 
                      textAlign: 'center', 
                      borderRadius: '12px',
                      border: '1px solid #D1D5DB',
                      background: '#F9FAFB', 
                      color: '#111827', 
                      fontWeight: '600',
                      outline: 'none', 
                      transition: 'all 0.2s ease',
                      padding: 0,
                      boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)'
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = '#2563EB';
                      e.target.style.background = '#FFFFFF';
                      e.target.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.1)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = otp[index] ? '#9CA3AF' : '#D1D5DB';
                      e.target.style.background = '#F9FAFB';
                      e.target.style.boxShadow = 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)';
                    }}
                  />
                ))}
              </div>

              <button 
                onClick={handleVerify}
                disabled={isSubmitting || otp.join('').length < 6}
                style={{ 
                  width: '100%', 
                  background: (isSubmitting || otp.join('').length < 6) ? '#93C5FD' : '#2563EB', 
                  color: 'white', 
                  border: 'none', 
                  padding: '1rem', 
                  borderRadius: '16px', 
                  fontSize: '1.05rem', 
                  fontWeight: '600', 
                  cursor: (isSubmitting || otp.join('').length < 6) ? 'not-allowed' : 'pointer', 
                  transition: 'all 0.2s',
                  boxShadow: (isSubmitting || otp.join('').length < 6) ? 'none' : '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
                }}
              >
                {isSubmitting ? 'מאמת...' : 'אמת קוד'}
              </button>
              
              <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '500', marginTop: '-0.5rem' }}>
                הזנתי מספר שגוי
              </button>
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { opacity: 0; transform: translate(-50%, -45%) scale(0.95); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
      `}</style>
    </>,
    document.body
  );
}

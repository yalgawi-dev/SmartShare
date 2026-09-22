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
      if (typeof window !== 'undefined' && !(window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'invisible'
          });
        } catch (e) {
          console.error("Recaptcha init error:", e);
        }
      }
    }
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
      setErrorMsg('מספר טלפון לא תקין');
      return;
    }
    
    // Admin mock bypass - ONLY for this exact dev number, no extra text
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
      if (error.code === 'auth/credential-already-in-use') {
        setErrorMsg('מספר טלפון זה כבר משויך לחשבון אחר.');
      } else if (error.code === 'auth/invalid-phone-number') {
        setErrorMsg('מספר טלפון לא תקין.');
      } else {
        setErrorMsg('שגיאה בשליחת קוד: ' + error.message);
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
      setErrorMsg('אנא הכנס 6 ספרות');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const formattedPhone = `+972${cleanPhone.replace(/^0/, '')}`;
      
      if (cleanPhone === '0500000000' || cleanPhone === '500000000') {
        if (code !== '123456') { 
          setErrorMsg('קוד שגוי.');
          setIsSubmitting(false);
          return; 
        }
        await linkPhoneNumberMock(formattedPhone);
      } else {
        if (!confirmationResult) {
          throw new Error('חסר אישור. נסה לשלוח שוב.');
        }
        await confirmationResult.confirm(code);
        await linkPhoneNumberMock(formattedPhone);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-verification-code') {
        setErrorMsg('הקוד שהזנת שגוי.');
      } else if (err.code === 'auth/code-expired') {
        setErrorMsg('הקוד פג תוקף, אנא בקש חדש.');
      } else {
        setErrorMsg('שגיאה באימות: ' + err.message);
      }
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <>
      <div id="recaptcha-container"></div>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999998, animation: 'fadeIn 0.2s ease-out' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#ffffff', borderRadius: '16px', width: '90%', maxWidth: '380px', zIndex: 999999, boxShadow: '0 20px 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
        
        <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '48px', height: '48px', background: '#e0f2fe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#111827', fontWeight: '600' }}>
            {step === 1 ? 'הכנס מספר טלפון' : 'אימות מספר'}
          </h2>
          
          <p style={{ margin: '0 0 2rem 0', color: '#6b7280', fontSize: '0.9rem', lineHeight: '1.5' }}>
            {step === 1 
              ? 'יש לאמת את מספר הטלפון שלך כדי להתחיל להשתמש במערכת.'
              : <span style={{ direction: 'ltr', display: 'inline-block' }}>SMS נשלח למספר +972 {phone.replace(/^0/, '')}</span>}
          </p>

          {errorMsg && (
            <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem', background: '#fef2f2', padding: '0.5rem', borderRadius: '8px' }}>
              {errorMsg}
            </div>
          )}

          {step === 1 ? (
            <>
              <div style={{ display: 'flex', borderBottom: '2px solid #2563eb', marginBottom: '1.5rem', transition: 'border-color 0.2s', paddingBottom: '0.25rem' }}>
                <span style={{ padding: '0.5rem 0.5rem 0.5rem 0', color: '#111827', fontWeight: '500', fontSize: '1.1rem', direction: 'ltr' }}>+972</span>
                <input 
                  type="tel" 
                  placeholder="50 123 4567" 
                  value={phone}
                  onChange={handlePhoneChange}
                  onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                  style={{ flex: 1, padding: '0.5rem', border: 'none', background: 'transparent', fontSize: '1.1rem', outline: 'none', color: '#111827', direction: 'ltr', letterSpacing: '1px' }}
                  autoFocus
                />
              </div>
              <button 
                onClick={handleSendCode}
                disabled={isSubmitting || phone.replace(/\D/g, '').length < 9}
                style={{ width: '100%', background: '#2563eb', color: 'white', border: 'none', padding: '0.875rem', borderRadius: '8px', fontSize: '1rem', fontWeight: '500', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: (isSubmitting || phone.replace(/\D/g, '').length < 9) ? 0.7 : 1, transition: 'background 0.2s' }}
              >
                {isSubmitting ? 'שולח...' : 'המשך'}
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', direction: 'ltr' }}>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <input
                    key={index}
                    ref={el => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    value={otp[index]}
                    onChange={e => handleOtpChange(index, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(index, e)}
                    style={{ width: '2.5rem', height: '3rem', fontSize: '1.5rem', textAlign: 'center', border: 'none', borderBottom: `2px solid ${otp[index] ? '#2563eb' : '#d1d5db'}`, background: 'transparent', color: '#111827', outline: 'none', transition: 'border-color 0.2s', padding: 0 }}
                    onFocus={e => e.target.style.borderBottom = '2px solid #2563eb'}
                    onBlur={e => e.target.style.borderBottom = `2px solid ${otp[index] ? '#2563eb' : '#d1d5db'}`}
                  />
                ))}
              </div>
              <button 
                onClick={handleVerify}
                disabled={isSubmitting || otp.join('').length < 6}
                style={{ width: '100%', background: '#2563eb', color: 'white', border: 'none', padding: '0.875rem', borderRadius: '8px', fontSize: '1rem', fontWeight: '500', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: (isSubmitting || otp.join('').length < 6) ? 0.7 : 1, transition: 'background 0.2s', marginBottom: '1rem' }}
              >
                {isSubmitting ? 'מאמת...' : 'אמת קוד'}
              </button>
              <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.9rem', cursor: 'pointer', fontWeight: '500' }}>
                ערוך מספר טלפון
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { opacity: 0; transform: translate(-50%, -45%) scale(0.96); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
      `}</style>
    </>,
    document.body
  );
}

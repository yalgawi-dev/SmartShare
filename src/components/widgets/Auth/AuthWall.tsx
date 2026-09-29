'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { RecaptchaVerifier, ConfirmationResult } from 'firebase/auth';
import { auth } from '@/lib/firebase';


export default function AuthWall() {
  const { user, loginWithPhone, isLoaded } = useAuth();
  
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && step === 1) {
      if (!(window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'invisible',
            callback: () => { /* reCAPTCHA solved */ },
            'expired-callback': () => { /* expired */ }
          });
        } catch (e) {
          console.error('reCAPTCHA init error', e);
        }
      }
    }
  }, [step]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const val = e.target.value.replace(/[^\d-]/g, '');
    setPhone(val);
  };

  const handleSendCode = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 9 || cleanPhone.length > 10) {
      setErrorMsg('יש להזין מספר טלפון חוקי בן 10 ספרות.');
      return;
    }
    
    // Admin mock bypass
    if (cleanPhone === '0500000000' || cleanPhone === '500000000') {
      setStep(2);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      const appVerifier = (window as any).recaptchaVerifier;
      const formattedPhone = `+972${cleanPhone.replace(/^0/, '')}`;
      
      const confirmation = await loginWithPhone(formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      setIsSubmitting(false);
      setStep(2);
    } catch (error: any) {
      console.error(error);
      setIsSubmitting(false);
      
      const errCode = error.code || '';
      if (errCode === 'auth/invalid-phone-number') {
        setErrorMsg('מספר הטלפון אינו תקין.');
      } else if (errCode === 'auth/too-many-requests') {
        setErrorMsg('יותר מדי ניסיונות. אנא נסה שוב מאוחר יותר.');
      } else {
        setErrorMsg('שגיאה בשליחת קוד. נסה שוב.');
      }
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    setErrorMsg('');
    if (value.length > 1) {
      const chars = value.replace(/\D/g, '').split('').slice(0, 6);
      const newOtp = [...otp];
      chars.forEach((c, i) => { if (index + i < 6) newOtp[index + i] = c; });
      setOtp(newOtp);
      return;
    }
    
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
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
      
      if (cleanPhone === '0500000000' || cleanPhone === '500000000') {
        if (code !== '123456') { 
          setErrorMsg('קוד שגוי.');
          setIsSubmitting(false);
          return; 
        }
      }
      
      if (!confirmationResult && cleanPhone !== '0500000000') {
        throw new Error('חסר אישור. אנא חזור לאחור.');
      }
      
      if (confirmationResult) {
        await confirmationResult.confirm(code.trim());
      }
      
      // onAuthStateChanged will pick up the login and update user context
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-verification-code') {
        setErrorMsg('קוד האימות שגוי, אנא נסה שוב.');
      } else if (err.code === 'auth/code-expired') {
        setErrorMsg('קוד האימות פג תוקף.');
      } else {
        setErrorMsg('שגיאה באימות הקוד.');
      }
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8" dir="rtl">
      
      {step === 2 && (
        <style>{`
          .grecaptcha-badge { visibility: hidden !important; }
        `}</style>
      )}

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <span className="text-2xl">🔒</span>
          </div>
        </div>
        <h2 className="mt-2 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          SmartShare
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 font-medium">
          התחברות מאובטחת באמצעות מספר טלפון
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 rounded-3xl sm:px-10 border border-slate-100">
          
          <div style={{ display: step === 1 ? 'block' : 'none' }}>
            <div id="recaptcha-container" className="flex justify-center mb-4"></div>
          </div>

          {step === 1 ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">מספר טלפון</label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-lg opacity-50">📱</span>
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    className="block w-full rounded-xl border-slate-300 pl-10 focus:ring-indigo-500 focus:border-indigo-500 text-lg h-14 bg-slate-50 text-left"
                    placeholder="050-000-0000"
                    dir="ltr"
                    onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100 text-center">
                  {errorMsg}
                </div>
              )}

              <button
                onClick={handleSendCode}
                disabled={isSubmitting || phone.length < 9}
                className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'המשך'}
                {!isSubmitting && <span className="mr-2 text-xl leading-none">&larr;</span>}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-6">
                  הזן את קוד 6 הספרות שנשלח למספר<br/>
                  <b className="text-slate-900 mt-1 block text-lg tracking-wider" dir="ltr">{phone}</b>
                </p>
                
                <div className="flex justify-center gap-2" dir="ltr">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      type="text"
                      maxLength={1}
                      className="w-12 h-14 text-center text-xl font-bold bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={digit}
                      onChange={e => {
                        handleOtpChange(i, e.target.value);
                        if (e.target.value && i < 5) {
                          document.getElementById(`otp-${i + 1}`)?.focus();
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Backspace' && !digit && i > 0) {
                          document.getElementById(`otp-${i - 1}`)?.focus();
                        }
                        if (e.key === 'Enter') {
                          handleVerify();
                        }
                      }}
                    />
                  ))}
                </div>
              </div>

              {errorMsg && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100 text-center">
                  {errorMsg}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleVerify}
                  disabled={isSubmitting || otp.join('').length < 6}
                  className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'אימות קוד'}
                </button>
                <button
                  onClick={() => {
                    setStep(1);
                    setOtp(['', '', '', '', '', '']);
                    setErrorMsg('');
                  }}
                  className="w-full flex justify-center py-3 px-4 border border-slate-300 rounded-xl shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                  disabled={isSubmitting}
                >
                  חזור לאחור
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { RecaptchaVerifier, ConfirmationResult } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { COUNTRIES } from '@/utils/countries';

export default function AuthWall() {
  const { loginWithPhone, loginWithGoogle, loginWithApple, isLoaded, user, updateProfile } = useAuth();
  
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+972');
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  useEffect(() => {
    // If user is logged in via social/secondary provider without phone, or missing realName
    if (user && !user.phone) {
      setStep(1);
    } else if (user && user.phone && !user.realName) {
      setStep(3);
    }
  }, [user]);

  // Web OTP API: Auto-read SMS code on mobile devices
  useEffect(() => {
    if (step !== 2) return;
    if (typeof window === 'undefined') return;

    let abortController: AbortController | null = null;
    if ('OTPCredential' in window || (navigator as any).credentials) {
      try {
        abortController = new AbortController();
        (navigator as any).credentials.get({
          otp: { transport: ['sms'] },
          signal: abortController.signal
        }).then((otpCredential: any) => {
          if (otpCredential && otpCredential.code) {
            const extractedCode = otpCredential.code.trim();
            if (/^\d{6}$/.test(extractedCode)) {
              const digits = extractedCode.split('');
              setOtp(digits);
              // Auto verify with the received code
              if (confirmationResult) {
                setIsSubmitting(true);
                confirmationResult.confirm(extractedCode).catch((err: any) => {
                  console.error('Auto OTP verify error:', err);
                  setIsSubmitting(false);
                });
              }
            }
          }
        }).catch((err: any) => {
          // Abort or unsupported - silent fallback to manual typing
          if (err.name !== 'AbortError') {
            console.log('WebOTP auto-read skipped:', err);
          }
        });
      } catch (e) {
        // Fallback silently
      }
    }

    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [step, confirmationResult]);


  const initRecaptcha = () => {
    if (typeof window === 'undefined') return;
    try {
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
        } catch (e) {}
        (window as any).recaptchaVerifier = null;
      }
      const container = document.getElementById('recaptcha-container');
      if (container) container.innerHTML = '';

      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => { /* reCAPTCHA solved silently */ },
        'expired-callback': () => {
          // Auto reset on expiration
          initRecaptcha();
        }
      });
      (window as any).recaptchaVerifier.render();
    } catch (e) {
      console.error('reCAPTCHA init error', e);
    }
  };

  useEffect(() => {
    if (step === 1) {
      initRecaptcha();
    }
    return () => {
      if (typeof window !== 'undefined' && (window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
          (window as any).recaptchaVerifier = null;
        } catch (e) {}
      }
      const container = document.getElementById('recaptcha-container');
      if (container) container.innerHTML = '';
    };
  }, [step]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const val = e.target.value.replace(/[^\d-]/g, '');
    setPhone(val);
  };

  const handleSendCode = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (countryCode === '+972') {
      if (cleanPhone.length < 9 || cleanPhone.length > 10) {
        setErrorMsg('יש להזין מספר טלפון חוקי בן 10 ספרות.');
        return;
      }
    } else {
      if (cleanPhone.length < 7 || cleanPhone.length > 15) {
        setErrorMsg('יש להזין מספר טלפון חוקי לקידומת זו.');
        return;
      }
    }
    
    // Admin mock bypass
    if (cleanPhone === '0500000000' || cleanPhone === '500000000') {
      setStep(2);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      let appVerifier = (window as any).recaptchaVerifier;
      if (!appVerifier) {
        initRecaptcha();
        appVerifier = (window as any).recaptchaVerifier;
      }

      if (!appVerifier) {
        setIsSubmitting(false);
        setErrorMsg('אימות האבטחה (reCAPTCHA) אינו מוכן. אנא רענן את הדף ונסה שוב.');
        return;
      }

      const formattedPhone = `${countryCode}${cleanPhone.replace(/^0/, '')}`;
      
      const confirmation = await loginWithPhone(formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      setIsSubmitting(false);
      setStep(2);
    } catch (error: any) {
      console.error('Phone login error:', error);
      setIsSubmitting(false);
      
      const errCode = error.code || '';
      const errMsg = error.message || '';

      // Re-initialize reCAPTCHA after any failure so the user doesn't get stuck with a consumed widget
      initRecaptcha();
      
      if (errCode === 'auth/argument-error') {
        setErrorMsg('שגיאת אימות זמנית. אנא נסה שוב.');
      } else if (errCode === 'auth/invalid-phone-number') {
        setErrorMsg('מספר הטלפון אינו תקין. ודא שהמספר הוזן ללא קידומת בינלאומית כפולה. (קוד: ' + errCode + ')');
      } else if (errCode === 'auth/too-many-requests') {
        setErrorMsg('יותר מדי ניסיונות בזמן קצר. גוגל חסמה זמנית את השליחה למספר זה. אנא המתן מספר דקות. (קוד: ' + errCode + ')');
      } else if (errCode === 'auth/quota-exceeded') {
        setErrorMsg('מכסת הודעות ה-SMS היומית של המערכת ב-Firebase הסתיימה. (קוד: ' + errCode + ')');
      } else if (errCode === 'auth/captcha-check-failed') {
        setErrorMsg('אימות האבטחה האוטומטי נכשל. אנא רענן את הדף ונסה שוב.');
      } else if (errCode === 'auth/app-not-authorized' || errCode === 'auth/unauthorized-domain') {
        setErrorMsg('הדומיין הנוכחי אינו מורשה במסוף Firebase Authentication. (קוד: ' + errCode + ')');
      } else if (errCode === 'auth/billing-not-enabled' || errCode === 'auth/operation-not-allowed') {
        setErrorMsg('שליחת SMS לא מופעלת בפרויקט Firebase או דורשת שדרוג תוכנית (Blaze). (קוד: ' + errCode + ')');
      } else if (errCode === 'auth/network-request-failed') {
        setErrorMsg('שגיאת תקשורת. בדוק את החיבור לאינטרנט ונסה שוב. (קוד: ' + errCode + ')');
      } else if (errCode.includes('-39') || errMsg.includes('-39')) {
        setErrorMsg('שגיאת חסימת ספאם של Firebase (שגיאה 39-). המתן מספר שעות או נסה ממכשיר אחר.');
      } else {
        const displayCode = errCode ? ` [${errCode}]` : '';
        setErrorMsg(`שגיאה בשליחת קוד: ${errMsg || 'נסה שוב'}${displayCode}`);
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

  
  const handleSaveName = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg('יש להזין שם מלא.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      // Race updateProfile with a 3.5s timeout so the button never stays stuck on spinner
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3500));
      await Promise.race([
        updateProfile({ realName: cleanName, nickname: cleanName.split(' ')[0] }),
        timeoutPromise
      ]);
    } catch (e) {
      console.error('Error saving name:', e);
      // Even if firestore errors, updateProfile already updated local user state
    } finally {
      setIsSubmitting(false);
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
      
    } catch (err: any) {
      console.error('Verify OTP error:', err);
      const code = err.code || '';
      const msg = err.message || '';
      if (code === 'auth/invalid-verification-code') {
        setErrorMsg('קוד האימות שגוי. אנא נסה שוב. (קוד: ' + code + ')');
      } else if (code === 'auth/code-expired') {
        setErrorMsg('קוד האימות פג תוקף. לחץ על "לא קיבלת קוד? שלח שוב" לקבלת קוד חדש. (קוד: ' + code + ')');
      } else if (code === 'auth/session-expired') {
        setErrorMsg('פג תוקף סשן האימות. אנא חזור לאחור ושלח קוד חדש. (קוד: ' + code + ')');
      } else {
        const displayCode = code ? ` [${code}]` : '';
        setErrorMsg(`שגיאה באימות הקוד: ${msg || 'נסה שוב'}${displayCode}`);
      }
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="auth-loading">
        <div className="spinner"></div>
        <style>{`
          .auth-loading {
            height: 100dvh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #F8FAFC;
          }
          .spinner {
            width: 40px; height: 40px;
            border: 4px solid var(--primary, #4F46E5);
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="auth-wrapper" dir="rtl">
      
      {step === 2 && (
        <style>{`
          .grecaptcha-badge { visibility: hidden !important; }
        `}</style>
      )}

      <div className="auth-header">
        <div className="auth-icon-wrap">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h2 className="auth-title">MySpace</h2>
        <p className="auth-subtitle">התחברות מאובטחת למרחב האישי שלך</p>
      </div>

      <div className="auth-card">
        <div style={{ display: step === 1 ? 'block' : 'none' }}>
          <div id="recaptcha-container" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}></div>
        </div>

        
        {step === 3 ? (
          <div className="auth-form">
            <div className="input-group">
              <label>איך קוראים לך?</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setErrorMsg(''); }}
                  className="auth-input"
                  placeholder="שם מלא"
                  onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                />
              </div>
            </div>
            {errorMsg && <div className="auth-error">{errorMsg}</div>}
            <button
              onClick={handleSaveName}
              disabled={isSubmitting || !name.trim()}
              className="auth-btn auth-btn-primary"
            >
              {isSubmitting ? <div className="spinner-small"></div> : 'שמור והמשך'}
            </button>
          </div>
        ) : step === 1 ? (
          <div className="auth-form">
            <div className="input-group">
              <label>מספר טלפון</label>
              
              <div className="phone-input-group" dir="ltr">
                <div className="country-select-wrapper">
                  <select 
                    className="country-select"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                  >
                    {COUNTRIES.map(c => (
                      <option key={`${c.iso2}-${c.dialCode}`} value={c.dialCode}>
                        {c.flag} {c.dialCode} ({c.iso2})
                      </option>
                    ))}
                  </select>
                  <div className="select-arrow">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="auth-input phone-input"
                  placeholder={countryCode === '+972' ? '050-000-0000' : 'Phone number'}
                  onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                />
              </div>

            </div>

            {errorMsg && (
              <div className="auth-error">
                {errorMsg}
              </div>
            )}

            <button
              onClick={handleSendCode}
              disabled={isSubmitting || phone.length < (countryCode === '+972' ? 9 : 7)}
              className="auth-btn auth-btn-primary"
            >
              {isSubmitting ? <div className="spinner-small"></div> : (
                <>
                  המשך
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </svg>
                </>
              )}
            </button>

            {/* Secondary sign-in methods (Google & Apple) */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0 0.75rem 0', gap: '0.75rem' }}>
              <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>או התחבר באמצעות</span>
              <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={async () => {
                  try {
                    setIsSubmitting(true);
                    setErrorMsg('');
                    await loginWithGoogle();
                  } catch (err: any) {
                    console.error('Google login error:', err);
                    setIsSubmitting(false);
                    if (err.code !== 'auth/popup-closed-by-user') {
                      setErrorMsg('ההתחברות עם Google נכשלה. נסה שוב.');
                    }
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                המשך באמצעות Google
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={async () => {
                  try {
                    setIsSubmitting(true);
                    setErrorMsg('');
                    await loginWithApple();
                  } catch (err: any) {
                    console.error('Apple login error:', err);
                    setIsSubmitting(false);
                    if (err.code !== 'auth/popup-closed-by-user') {
                      setErrorMsg('ההתחברות עם Apple נכשלה או שאינה מוגדרת.');
                    }
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  border: '1px solid #1e293b',
                  background: '#0f172a',
                  color: '#ffffff',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 1.01-2.87-.96.04-2.14.65-2.77 1.39-.55.63-.98 1.66-.88 2.68 1.07.08 2.03-.45 2.64-1.2z"/>
                </svg>
                המשך באמצעות Apple
              </button>
            </div>
          </div>
        ) : (
          <div className="auth-form">
            <div className="otp-header">
              <p>הזן את קוד 6 הספרות שנשלח למספר</p>
              <b dir="ltr">{countryCode} {phone}</b>
            </div>
            
            <div className="otp-inputs" dir="ltr">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  className="otp-input"
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

            {errorMsg && (
              <div className="auth-error">
                {errorMsg}
              </div>
            )}

            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <button 
                onClick={() => {
                  setStep(1);
                  setOtp(['', '', '', '', '', '']);
                  setErrorMsg('');
                  setTimeout(() => {
                    handleSendCode();
                  }, 150);
                }} 
                disabled={isSubmitting} 
                style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '500', textDecoration: 'underline' }}
              >
                לא קיבלת קוד? שלח שוב
              </button>
            </div>

            <div className="auth-actions">
              <button
                onClick={handleVerify}
                disabled={isSubmitting || otp.join('').length < 6}
                className="auth-btn auth-btn-primary"
              >
                {isSubmitting ? <div className="spinner-small"></div> : 'אימות קוד'}
              </button>
              <button
                onClick={() => {
                  setStep(1);
                  setOtp(['', '', '', '', '', '']);
                  setErrorMsg('');
                }}
                className="auth-btn auth-btn-secondary"
                disabled={isSubmitting}
              >
                חזור לאחור
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .auth-wrapper {
          min-height: 100dvh;
          background: linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: var(--font-sans, system-ui, sans-serif);
        }

        .auth-header {
          text-align: center;
          margin-bottom: 32px;
          animation: slideUp 0.6s ease-out;
        }

        .auth-icon-wrap {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, var(--primary, #4F46E5) 0%, var(--primary-hover, #4338CA) 100%);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          color: white;
          box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4);
        }

        .auth-title {
          font-size: 32px;
          font-weight: 800;
          color: #0F172A;
          margin: 0 0 8px 0;
          letter-spacing: -0.5px;
        }

        .auth-subtitle {
          font-size: 16px;
          color: #64748B;
          margin: 0;
          font-weight: 500;
        }

        .auth-card {
          width: 100%;
          max-width: 420px;
          background: #FFFFFF;
          border-radius: 28px;
          padding: 32px;
          box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.02);
          animation: slideUp 0.6s ease-out 0.1s both;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .input-group label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #334155;
          margin-bottom: 8px;
        }

        .phone-input-group {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .country-select-wrapper {
          position: relative;
          height: 56px;
        }

        .country-select {
          appearance: none;
          height: 100%;
          background: #F8FAFC;
          border: 2px solid #E2E8F0;
          border-radius: 16px;
          padding: 0 32px 0 16px;
          font-size: 16px;
          font-weight: 600;
          color: #0F172A;
          cursor: pointer;
          outline: none;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .country-select:focus {
          border-color: var(--primary, #4F46E5);
          background: #FFFFFF;
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1);
        }

        .select-arrow {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: #64748B;
          display: flex;
        }

        .auth-input {
          width: 100%;
          height: 56px;
          background: #F8FAFC;
          border: 2px solid #E2E8F0;
          border-radius: 16px;
          padding: 0 16px;
          font-size: 18px;
          font-family: inherit;
          color: #0F172A;
          transition: all 0.2s ease;
          outline: none;
          box-sizing: border-box;
        }

        .phone-input {
          flex: 1;
        }

        .auth-input:focus {
          border-color: var(--primary, #4F46E5);
          background: #FFFFFF;
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1);
        }

        .auth-input::placeholder {
          color: #94A3B8;
        }

        .auth-btn {
          width: 100%;
          height: 56px;
          border-radius: 16px;
          font-size: 18px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          outline: none;
          font-family: inherit;
        }

        .auth-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none !important;
        }

        .auth-btn-primary {
          background: var(--primary, #4F46E5);
          color: white;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
        }

        .auth-btn-primary:not(:disabled):hover {
          background: var(--primary-hover, #4338CA);
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(79, 70, 229, 0.3);
        }

        .auth-btn-primary:not(:disabled):active {
          transform: translateY(0);
        }

        .auth-btn-secondary {
          background: #F1F5F9;
          color: #475569;
        }

        .auth-btn-secondary:not(:disabled):hover {
          background: #E2E8F0;
        }

        .auth-error {
          background: #FEF2F2;
          border: 1px solid #FECACA;
          color: #DC2626;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          text-align: center;
          animation: shake 0.4s ease-in-out;
        }

        .otp-header {
          text-align: center;
          margin-bottom: 8px;
        }
        
        .otp-header p {
          color: #64748B;
          font-size: 15px;
          margin: 0 0 8px 0;
        }

        .otp-header b {
          color: #0F172A;
          font-size: 20px;
          letter-spacing: 1px;
          display: block;
        }

        .otp-inputs {
          display: flex;
          justify-content: center;
          gap: 12px;
        }

        .otp-input {
          width: 50px;
          height: 60px;
          background: #F8FAFC;
          border: 2px solid #E2E8F0;
          border-radius: 14px;
          font-size: 24px;
          font-weight: 700;
          text-align: center;
          color: #0F172A;
          transition: all 0.2s ease;
          outline: none;
        }

        .otp-input:focus {
          border-color: var(--primary, #4F46E5);
          background: #FFFFFF;
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1);
        }

        .auth-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .spinner-small {
          width: 24px; height: 24px;
          border: 3px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin { 100% { transform: rotate(360deg); } }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
        }

        /* Mobile adjustments */
        @media (max-width: 480px) {
          .auth-wrapper {
            padding: 16px;
          }
          .auth-card {
            padding: 24px 20px;
            border-radius: 24px;
          }
          .country-select {
            padding: 0 24px 0 12px;
            font-size: 14px;
          }
          .otp-inputs {
            gap: 8px;
          }
          .otp-input {
            width: 44px;
            height: 54px;
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
}

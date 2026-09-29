'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { RecaptchaVerifier, ConfirmationResult } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function AuthWall() {
  const { loginWithPhone, isLoaded } = useAuth();
  
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+972');
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
      const appVerifier = (window as any).recaptchaVerifier;
      const formattedPhone = `${countryCode}${cleanPhone.replace(/^0/, '')}`;
      
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
        <h2 className="auth-title">SmartShare</h2>
        <p className="auth-subtitle">התחברות מאובטחת למרחב האישי שלך</p>
      </div>

      <div className="auth-card">
        <div style={{ display: step === 1 ? 'block' : 'none' }}>
          <div id="recaptcha-container" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}></div>
        </div>

        {step === 1 ? (
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
                    <option value="+972">🇮🇱 +972</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+33">🇫🇷 +33</option>
                    <option value="+49">🇩🇪 +49</option>
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

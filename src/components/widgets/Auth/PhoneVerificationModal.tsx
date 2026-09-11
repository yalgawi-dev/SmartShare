'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../../app/context/AuthContext';

export default function PhoneVerificationModal() {
  const { user, linkPhoneNumberMock, isLoaded } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { setMounted(true); }, []);

  const shouldShow = isLoaded && user && !user.phone;
  if (!mounted || !shouldShow) return null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const val = e.target.value.replace(/[^\d-]/g, '');
    setPhone(val);
  };

  const handleSendCode = () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 9 || cleanPhone.length > 10) {
      setErrorMsg('אנא הזן מספר סלולרי תקין');
      return;
    }
    setErrorMsg('');
    setStep(2);
    // Focus first OTP input
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    // Take only the last character if they pasted or typed multiple
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    setErrorMsg('');

    // Move to next input
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
      setErrorMsg('אנא הזן קוד בן 6 ספרות');
      return;
    }
    if (code !== '123456') { 
      setErrorMsg('קוד שגוי. (מצב פיתוח: הקוד הוא 123456)');
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (linkPhoneNumberMock) {
        await linkPhoneNumberMock(`+972${phone.replace(/^0/, '').replace(/\D/g, '')}`);
      }
    } catch (err) {
      setErrorMsg('שגיאה בקישור הטלפון. נסה שנית.');
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.8)', zIndex: 999998, backdropFilter: 'blur(12px)', animation: 'fadeIn 0.3s ease-out' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#ffffff', borderRadius: '28px', width: '90%', maxWidth: '440px', zIndex: 999999, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'slideUpScale 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        
        {/* Header Graphic */}
        <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', padding: '2.5rem 2rem 1.5rem', textAlign: 'center', position: 'relative' }}>
          <div style={{ width: '80px', height: '80px', background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.3)' }}>
            <span style={{ fontSize: '2.5rem' }}>{step === 1 ? '🛡️' : '💬'}</span>
          </div>
          <h2 style={{ margin: '0', fontSize: '1.75rem', color: '#1e3a8a', fontWeight: '800' }}>
            {step === 1 ? 'אבטחת החשבון' : 'אימות מספר'}
          </h2>
        </div>

        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: '1.05rem', lineHeight: 1.6 }}>
            {step === 1 
              ? 'כדי שחברים יוכלו למצוא אותך ולהזמין אותך למרחבים משותפים בקלות, אנו זקוקים למספר הטלפון שלך.'
              : <span>שלחנו קוד אימות למספר <b style={{color:'#0f172a', direction:'ltr', display:'inline-block'}}>+972 {phone}</b></span>}
          </div>

          {errorMsg && (
            <div style={{ background: '#fef2f2', color: '#ef4444', padding: '0.75rem', borderRadius: '12px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 'bold', animation: 'shake 0.4s ease-in-out' }}>
              {errorMsg}
            </div>
          )}

          {step === 1 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Premium Phone Input */}
              <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', transition: 'all 0.2s', focusWithin: { borderColor: '#3b82f6', background: 'white', boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.1)' } } as any}>
                <div style={{ padding: '1rem', background: '#f1f5f9', borderLeft: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', color: '#334155', direction: 'ltr' }}>
                  <span>🇮🇱</span>
                  <span>+972</span>
                </div>
                <input 
                  type="tel" 
                  placeholder="50 123 4567" 
                  value={phone}
                  onChange={handlePhoneChange}
                  onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                  style={{ flex: 1, padding: '1rem', border: 'none', background: 'transparent', fontSize: '1.25rem', outline: 'none', color: '#0f172a', direction: 'ltr', letterSpacing: '2px', fontWeight: 'bold' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#10b981', fontSize: '0.85rem', fontWeight: 'bold' }}>
                <span>🔒</span> המידע שלך מוצפן ומאובטח מקצה לקצה
              </div>

              <button 
                onClick={handleSendCode}
                style={{ background: 'var(--primary, #3b82f6)', color: 'white', border: 'none', padding: '1.25rem', borderRadius: '16px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)', transition: 'transform 0.1s, boxShadow 0.1s' }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                שלח קוד לאימות
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
              
              {/* 6-Digit OTP UI */}
              <div style={{ display: 'flex', gap: '0.5rem', direction: 'ltr' }}>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <input
                    key={index}
                    ref={el => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    value={otp[index]}
                    onChange={e => handleOtpChange(index, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(index, e)}
                    style={{ width: '3rem', height: '4rem', fontSize: '2rem', textAlign: 'center', borderRadius: '12px', border: '2px solid #cbd5e1', background: '#f8fafc', fontWeight: 'bold', color: '#0f172a', outline: 'none', transition: 'all 0.2s' }}
                    onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = 'white'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.2)'; }}
                    onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }}
                  />
                ))}
              </div>

              <button 
                onClick={handleVerify}
                disabled={isSubmitting}
                style={{ width: '100%', background: 'var(--success, #10b981)', color: 'white', border: 'none', padding: '1.25rem', borderRadius: '16px', fontSize: '1.1rem', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1, boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)' }}
              >
                {isSubmitting ? 'מאמת נתונים...' : 'אישור הרשמה'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.9rem' }}>
                <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 'bold' }}>
                  שנה מספר
                </button>
                <div style={{ color: '#94a3b8' }}>
                  (מצב בדיקה: השתמש בקוד 123456)
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUpScale { from { opacity: 0; transform: translate(-50%, -45%) scale(0.95); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
      `}</style>
    </>,
    document.body
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../../app/context/AuthContext';

export default function PhoneVerificationModal() {
  const { user, linkPhoneNumberMock, isLoaded } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState(1);
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Show only if user is loaded, logged in, but has no phone number
  const shouldShow = isLoaded && user && !user.phone;

  if (!mounted || !shouldShow) return null;

  const handleSendCode = () => {
    if (phone.replace(/\D/g, '').length < 9) {
      alert('אנא הזן מספר טלפון תקין');
      return;
    }
    // Simulation: move to OTP step
    setStep(2);
  };

  const handleVerify = async () => {
    if (code !== '123456') { // Mock OTP
      alert('קוד שגוי. הקוד לסימולציה הוא 123456');
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (linkPhoneNumberMock) {
        await linkPhoneNumberMock(phone);
      }
      // Once linked, user.phone will be updated and shouldShow becomes false
    } catch (err) {
      alert('שגיאה בקישור הטלפון');
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.8)', zIndex: 999998, backdropFilter: 'blur(8px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#ffffff', borderRadius: '24px', width: '90%', maxWidth: '400px', zIndex: 999999, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📱</div>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem', color: '#0f172a' }}>השלמת פרופיל</h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.5 }}>
            {step === 1 
              ? 'כדי שחברים יוכלו להזמין אותך בקלות למרחבים, אנא אמת את מספר הטלפון שלך (חד פעמי).'
              : 'שלחנו לך קוד אימות לטלפון (לצורך הסימולציה הקלד 123456)'}
          </p>

          {step === 1 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input 
                type="tel" 
                placeholder="מספר טלפון (לדוגמה 050-1234567)" 
                value={phone}
                onChange={e => setPhone(e.target.value)}
                style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid var(--border-light)', fontSize: '1.1rem', textAlign: 'center', direction: 'ltr' }}
              />
              <button 
                onClick={handleSendCode}
                style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '1rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}
              >
                שלח קוד אימות
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input 
                type="number" 
                placeholder="קוד אימות (6 ספרות)" 
                value={code}
                onChange={e => setCode(e.target.value)}
                style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid var(--border-light)', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '0.5rem', direction: 'ltr' }}
              />
              <button 
                onClick={handleVerify}
                disabled={isSubmitting}
                style={{ background: 'var(--success)', color: 'white', border: 'none', padding: '1rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
              >
                {isSubmitting ? 'מאמת...' : 'אמת והמשך'}
              </button>
              <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginTop: '0.5rem' }}>
                חזור אחורה
              </button>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

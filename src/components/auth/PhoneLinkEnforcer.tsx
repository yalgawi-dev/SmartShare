import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../app/context/AuthContext';
import { auth, db } from '@/lib/firebase';
import { RecaptchaVerifier, linkWithCredential, PhoneAuthProvider } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function PhoneLinkEnforcer() {
  const { user, isLoaded, updateProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).recaptchaVerifierLink) {
      try {
        (window as any).recaptchaVerifierLink = new RecaptchaVerifier(auth, 'recaptcha-container-link', {
          size: 'invisible',
        });
      } catch (e) {
        console.error("Recaptcha error:", e);
      }
    }
  }, []);

  if (!isLoaded || !user) return null;
  // If the user is an admin or already has a phone, or is anonymous, we don't block them.
  // Wait, if they are anonymous, they don't have a phone, but we only force verified users.
  if (user.phone || (user as any).isAnonymous || user.isAdmin) return null;

  const handleSendCode = async () => {
    if (phone.length < 9) {
      setErrorMsg("מספר טלפון לא תקין");
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const formattedPhone = phone.startsWith('0') ? '+972' + phone.substring(1) : '+972' + phone;
      const appVerifier = (window as any).recaptchaVerifierLink;
      
      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber(formattedPhone, appVerifier);
      setConfirmationResult(verificationId);
      setStep(2);
      setIsSubmitting(false);
    } catch (error: any) {
      console.error(error);
      setIsSubmitting(false);
      setErrorMsg("שגיאה בשליחת SMS. נסה שוב.");
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
      setErrorMsg("הזן קוד בן 6 ספרות");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const formattedPhone = phone.startsWith('0') ? '+972' + phone.substring(1) : '+972' + phone;
      const credential = PhoneAuthProvider.credential(confirmationResult, code);
      
      if (auth.currentUser) {
        try {
          await linkWithCredential(auth.currentUser, credential);
        } catch (linkError: any) {
          if (linkError.code === 'auth/credential-already-in-use') {
            setErrorMsg("הטלפון הזה רשום תחת חשבון כפול ריק. אנא התנתק, התחבר עם הטלפון, היכנס להגדרות, מחק את החשבון הריק, ואז חזור לכאן.");
            setIsSubmitting(false);
            return;
          }
          throw linkError;
        }
      }

      await updateProfile({ phone: formattedPhone });
      // update firebase as well just in case
      await setDoc(doc(db, 'users', user.id), { phone: formattedPhone }, { merge: true });
      
    } catch (error: any) {
      console.error(error);
      setIsSubmitting(false);
      setErrorMsg("קוד שגוי או שגיאה בקישור החשבון");
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(8px)' }}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '2rem', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📱</div>
        <h2 style={{ margin: '0 0 1rem 0', color: '#1f2937' }}>אבטחת חשבון חובה</h2>
        <p style={{ color: '#4b5563', marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
          על מנת לאבטח את המידע שלך ולאפשר התחברות קלה בעתיד, חובה לאמת את מספר הטלפון שלך. מספר זה יקושר לחשבונך.
        </p>

        <div id="recaptcha-container-link"></div>
        {errorMsg && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 'bold' }}>{errorMsg}</div>}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', direction: 'ltr' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '12px', padding: '0 1rem', fontWeight: 'bold', color: '#4b5563' }}>+972</div>
              <input type="tel" placeholder="5X-XXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} disabled={isSubmitting} style={{ flex: 1, padding: '0.8rem', fontSize: '1.1rem', borderRadius: '12px', border: '1px solid #d1d5db', width: '100%' }} />
            </div>
            <button onClick={handleSendCode} disabled={isSubmitting} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '1rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
              {isSubmitting ? 'שולח קוד...' : 'שלח קוד אימות'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', direction: 'ltr' }}>
              {otp.map((digit, i) => (
                <input key={i} ref={el => { inputRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={digit} onChange={e => handleOtpChange(i, e.target.value)} style={{ width: '45px', height: '55px', fontSize: '1.5rem', textAlign: 'center', border: '2px solid #e5e7eb', borderRadius: '12px', background: '#f9fafb', color: '#111827', fontWeight: 'bold' }} disabled={isSubmitting} />
              ))}
            </div>
            <button onClick={verifyCode} disabled={isSubmitting || otp.some(d => !d)} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '1rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
              {isSubmitting ? 'מאמת...' : 'אמת וקשר חשבון'}
            </button>
            <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#6b7280', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem' }}>
              חזור לשנות מספר
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

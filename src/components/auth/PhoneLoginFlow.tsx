import React, { useState, useRef, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { RecaptchaVerifier, ConfirmationResult, updateProfile as updateFirebaseProfile, PhoneAuthProvider, linkWithCredential, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../app/context/AuthContext';
import styles from './AuthModal.module.css';

export default function PhoneLoginFlow({ onSuccess, onCancel }: { onSuccess: () => void, onCancel: () => void }) {
  const { loginWithPhone, isLoaded } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).recaptchaVerifierPhoneLogin) {
      try {
        (window as any).recaptchaVerifierPhoneLogin = new RecaptchaVerifier(auth, 'recaptcha-container-phone-login', {
          size: 'invisible'
        });
      } catch (e) {
        console.error("Recaptcha init error:", e);
      }
    }
  }, []);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const val = e.target.value.replace(/[^\d-]/g, '');
    setPhone(val);
  };

  const handleSendCode = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 9 || cleanPhone.length > 10) {
      setErrorMsg('מספר טלפון לא תקין. יש להזין 9 או 10 ספרות.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const appVerifier = (window as any).recaptchaVerifierPhoneLogin;
      const formattedPhone = `+972${cleanPhone.replace(/^0/, '')}`;
      const confirmation = await loginWithPhone(formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      setIsSubmitting(false);
      setStep(2);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (error: any) {
      console.error(error);
      setIsSubmitting(false);
      if (error.code === 'auth/invalid-phone-number') setErrorMsg('מספר הטלפון שהוזן אינו חוקי.');
      else if (error.code === 'auth/too-many-requests') setErrorMsg('יותר מדי ניסיונות. אנא נסה שוב מאוחר יותר.');
      else setErrorMsg('שגיאה בשליחת קוד. ודא שהמספר תקין ונסה שוב.');
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

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyCode = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setErrorMsg('יש להזין קוד בן 6 ספרות');
      return;
    }
    if (!confirmationResult) return;

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const result = await confirmationResult.confirm(code);
      const user = result.user;
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && userDoc.data().realName) {
        onSuccess();
      } else {
        setStep(3);
        setIsSubmitting(false);
      }
    } catch (error: any) {
      console.error(error);
      setIsSubmitting(false);
      if (error.code === 'auth/invalid-verification-code') setErrorMsg('הקוד שהוזן שגוי. אנא נסה שוב.');
      else if (error.code === 'auth/code-expired') setErrorMsg('הקוד פג תוקף. יש לשלוח קוד חדש.');
      else setErrorMsg('שגיאה באימות הקוד.');
    }
  };

  const saveNameAndFinish = async () => {
    if (!name.trim()) {
      setErrorMsg('אנא הזן את שמך המלא');
      return;
    }
    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      if (user) {
        await updateFirebaseProfile(user, { displayName: name });
        await setDoc(doc(db, 'users', user.uid), {
          realName: name,
          phone: user.phoneNumber,
          userId: user.uid,
          createdAt: Date.now(),
          provider: 'phone'
        }, { merge: true });
        onSuccess();
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg('שגיאה בשמירת הנתונים.');
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      <div id="recaptcha-container-phone-login"></div>
      
      {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.3s ease-out' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>הזן את מספר הטלפון שלך לקבלת קוד אימות ב-SMS. ללא סיסמאות.</p>
          <div className={styles.inputGroup}>
            <label>מספר טלפון</label>
            <div style={{ display: 'flex', gap: '0.5rem', direction: 'ltr' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '0 1rem', fontWeight: 'bold', color: '#4b5563' }}>
                <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>🇮🇱</span>
                +972
              </div>
              <input type="tel" placeholder="5X-XXXXXXX" value={phone} onChange={handlePhoneChange} disabled={isSubmitting} style={{ flex: 1, padding: '0.8rem', fontSize: '1.1rem', borderRadius: '12px', border: '1px solid var(--border-light)' }} autoFocus />
            </div>
          </div>
          <button onClick={handleSendCode} disabled={isSubmitting || phone.length < 9} className={styles.primaryBtn} style={{ background: '#25D366' }}>
            {isSubmitting ? 'שולח...' : 'שלח קוד אימות'}
          </button>
          <button onClick={onCancel} className={styles.switchBtn} style={{ marginTop: '0.5rem' }}>חזור להתחברות רגילה</button>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>הזן את הקוד שקיבלת</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>שלחנו קוד בעל 6 ספרות למספר<br/><strong style={{ color: 'var(--text-primary)', direction: 'ltr', display: 'inline-block', marginTop: '0.25rem' }}>+972 {phone.replace(/^0/, '')}</strong></p>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', direction: 'ltr' }}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleOtpKeyDown(i, e)}
                disabled={isSubmitting}
                style={{ width: '45px', height: '55px', fontSize: '1.5rem', textAlign: 'center', fontWeight: 'bold', borderRadius: '12px', border: `2px solid ${digit ? 'var(--primary)' : 'var(--border-light)'}`, background: digit ? 'var(--bg-main)' : 'var(--bg-card)', transition: 'all 0.2s', outline: 'none' }}
              />
            ))}
          </div>

          <button onClick={verifyCode} disabled={isSubmitting || otp.join('').length !== 6} className={styles.primaryBtn} style={{ background: '#25D366' }}>
            {isSubmitting ? 'מאמת...' : 'אמת והיכנס'}
          </button>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.3s ease-out' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>ברוך הבא!</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>זיהינו שאתה משתמש חדש. איך קוראים לך?</p>
          </div>
          
          <div className={styles.inputGroup}>
            <label>שם מלא</label>
            <input type="text" placeholder="הכנס שם פרטי ומשפחה" value={name} onChange={e => setName(e.target.value)} disabled={isSubmitting} style={{ padding: '0.8rem', fontSize: '1.1rem', borderRadius: '12px', border: '1px solid var(--border-light)' }} autoFocus />
          </div>

          <button onClick={saveNameAndFinish} disabled={isSubmitting || !name.trim()} className={styles.primaryBtn} style={{ background: '#25D366' }}>
            {isSubmitting ? 'שומר...' : 'סיום וכניסה לאפליקציה'}
          </button>
        </div>
      )}
    </div>
  );
}

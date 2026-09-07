'use client';

import React, { useState } from 'react';
import { useAuth } from '../../app/context/AuthContext';
import styles from './AuthModal.module.css';

interface AuthModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
}

export default function AuthModal({ onClose, onSuccess, title = 'התחברות למערכת' }: AuthModalProps) {
  const { loginWithGoogle, loginWithFacebook, loginWithEmail, registerWithEmail, resetPassword } = useAuth();
  
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMsg('');

    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        onSuccess?.();
        onClose();
      } else if (mode === 'register') {
        if (!name.trim()) throw new Error('יש להזין שם מלא');
        if (password.length < 6) throw new Error('הסיסמה חייבת להכיל לפחות 6 תווים');
        await registerWithEmail(email, password, name);
        onSuccess?.();
        onClose();
      } else if (mode === 'forgot') {
        if (!email.trim()) throw new Error('יש להזין כתובת אימייל');
        await resetPassword(email);
        setMsg('נשלח קישור לאיפוס סיסמה למייל שלך. בדוק את תיבת הדואר.');
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
         setError('אימייל או סיסמה שגויים.');
      } else {
         setError(err.message || 'אירעה שגיאה. נסה שוב.');
      }
    } finally {
      setLoading(false);
    }
  };

  const [providerLoading, setProviderLoading] = useState<'google' | 'facebook' | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);

  const handleProviderLogin = async (providerName: 'google' | 'facebook') => {
    setProviderLoading(providerName);
    setPopupBlocked(false);
    try {
      if (providerName === 'google') await loginWithGoogle();
      if (providerName === 'facebook') await loginWithFacebook();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      if (err?.code === 'auth/popup-blocked') {
        setPopupBlocked(true);
      }
    } finally {
      setProviderLoading(null);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        
        <div className={styles.header}>
          <div className={styles.logo}>?</div>
          <h2 className={styles.title}>{mode === 'register' ? 'צור חשבון חדש' : mode === 'forgot' ? 'איפוס סיסמה' : title}</h2>
          <p className={styles.subtitle}>
            {mode === 'register' ? 'הצטרף עכשיו בחינם כדי לשמור את הנתונים שלך' : mode === 'forgot' ? 'הזן את המייל שלך ונשלח לך קישור ??יפוס' : 'התחבר כדי לגשת למרחבים האישיים שלך'}
          </p>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}
        {msg && <div className={styles.successBanner}>{msg}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className={styles.inputGroup}>
              <label>שם מלא</label>
              <input type="text" placeholder="ישראל ישראלי" value={name} onChange={e => setName(e.target.value)} disabled={loading} required />
            </div>
          )}
          
          <div className={styles.inputGroup}>
            <label>אימייל</label>
            <input type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} required />
          </div>

          {mode !== 'forgot' && (
            <div className={styles.inputGroup}>
              <label>סיסמה</label>
              <input type="password" placeholder="" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} required />
            </div>
          )}

          {mode === 'login' && (
            <button type="button" className={styles.textBtn} onClick={() => setMode('forgot')} style={{ alignSelf: 'flex-start', marginTop: '-0.5rem' }}>
              שכחת סיסמה?
            </button>
          )}

          <button type="submit" className={styles.primaryBtn} disabled={loading}>
            {loading ? 'מעבד...' : mode === 'register' ? 'הרשמה בחינם' : mode === 'forgot' ? 'שלח קישור איפוס' : 'התחברות'}
          </button>
        </form>

        {mode !== 'forgot' && (
          <>
            <div className={styles.divider}>
              <span>או התחבר באמצעות</span>
            </div>

            <div className={styles.socialGrid}>
              <button onClick={() => handleProviderLogin('google')} className={styles.socialBtn} style={{ color: '#ea4335', borderColor: '#e2e8f0' }}>
                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Google
              </button>
              <button onClick={() => handleProviderLogin('facebook')} className={styles.socialBtn} style={{ background: '#1877F2', color: 'white', borderColor: '#1877F2' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>f</span>
                Facebook
              </button>
            </div>
            <style>{`
              @keyframes popUpGlowAlert {
                0% { background: #f8fafc; border-color: #e2e8f0; box-shadow: 0 0 0 rgba(59, 130, 246, 0); transform: translateY(0) scale(1); }
                10% { background: #eff6ff; border-color: #3b82f6; box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4); transform: translateY(-4px) scale(1.02); }
                20% { background: #eff6ff; border-color: #3b82f6; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3); transform: translateY(-2px) scale(1.01); }
                35% { background: #f8fafc; border-color: #e2e8f0; box-shadow: 0 0 0 rgba(59, 130, 246, 0); transform: translateY(0) scale(1); }
                100% { background: #f8fafc; border-color: #e2e8f0; box-shadow: 0 0 0 rgba(59, 130, 246, 0); transform: translateY(0) scale(1); }
              }
              @keyframes popUpIconWiggle {
                0% { transform: scale(1); }
                10% { transform: scale(1.3) rotate(-15deg); }
                15% { transform: scale(1.3) rotate(15deg); }
                20% { transform: scale(1.3) rotate(-10deg); }
                25% { transform: scale(1) rotate(0deg); }
                100% { transform: scale(1); }
              }
              .animated-popup-warning {
                animation: popUpGlowAlert 6s cubic-bezier(0.25, 0.8, 0.25, 1) infinite;
                animation-delay: 0.5s; 
              }
              .animated-popup-warning-active {
                animation: popUpGlowAlert 1.5s cubic-bezier(0.25, 0.8, 0.25, 1) infinite;
                background: #eff6ff !important;
                border-color: #3b82f6 !important;
                box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4) !important;
              }
              .animated-popup-warning-blocked {
                animation: popUpGlowAlertBlocked 1.5s cubic-bezier(0.25, 0.8, 0.25, 1) infinite;
                background: #fef2f2 !important;
                border-color: #ef4444 !important;
                box-shadow: 0 4px 20px rgba(239, 68, 68, 0.5) !important;
              }
              @keyframes popUpGlowAlertBlocked {
                0% { box-shadow: 0 0 0 rgba(239, 68, 68, 0); transform: translateY(0) scale(1); }
                50% { box-shadow: 0 4px 20px rgba(239, 68, 68, 0.6); transform: translateY(-4px) scale(1.02); }
                100% { box-shadow: 0 0 0 rgba(239, 68, 68, 0); transform: translateY(0) scale(1); }
              }
              .animated-popup-icon {
                display: inline-block;
                animation: popUpIconWiggle 6s ease-in-out infinite;
                animation-delay: 0.5s;
              }
            `}</style>
            <div className={popupBlocked ? "animated-popup-warning-blocked" : providerLoading ? "animated-popup-warning-active" : "animated-popup-warning"} style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#475569', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.75rem', padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', transition: 'all 0.3s ease' }}>
              <span className="animated-popup-icon" style={{ fontSize: '1.5rem', flexShrink: 0 }}>
                {popupBlocked ? '🚨' : providerLoading ? '⏳' : '💡'}
              </span>
              <div style={{ lineHeight: '1.4' }}>
                <strong style={{ display: 'block', color: popupBlocked ? '#ef4444' : '#0f172a', fontSize: '0.9rem', margin: '0 0 0.1rem 0' }}>
                  {popupBlocked ? 'הדפדפן חסם את חלון ההתחברות!' : providerLoading ? 'פותח חלון חיבור...' : 'חלון ההתחברות לא נפתח?'}
                </strong>
                {popupBlocked 
                  ? 'אנא לחץ על הסימון בשורת הכתובת למעלה (Pop-up Blocker) ואשר פתיחת חלונות מהאתר.'
                  : providerLoading 
                    ? 'אם חלון לא קפץ כעת, ייתכן שהדפדפן חסם אותו. אנא אשר חלונות קופצים למעלה.'
                    : 'יש לאשר "חלונות קופצים" (Pop-ups) בשורת הכתובת של הדפדפן.'}
              </div>
            </div>
          </>
        )}

        <div className={styles.footer}>
          {mode === 'login' ? (
            <p>אין לך חשבון עדיין? <button className={styles.switchBtn} onClick={() => setMode('register')}>הרשם עכשיו בחינם</button></p>
          ) : (
            <p>כבר יש לך חשבון? <button className={styles.switchBtn} onClick={() => setMode('login')}>התחבר עכשיו</button></p>
          )}
        </div>
      </div>
    </div>
  );
}

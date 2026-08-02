'use client';

import { useState } from 'react';
import { useAuth } from '../../app/context/AuthContext';
import styles from './RegistrationModal.module.css';

import { auth } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

export default function RegistrationModal() {
  const { user, login, updateProfile, isLoaded } = useAuth();
  const [phone, setPhone] = useState('');
  const [realName, setRealName] = useState('');
  const [nickname, setNickname] = useState('');
  const [status, setStatus] = useState<any>('hidden');

  // Show modal only if user is logged in anonymously but hasn't filled their details
  if (!isLoaded || !user || user.realName !== 'אורח') return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.trim() && realName.trim()) {
      login(phone, realName);
      setTimeout(() => {
        updateProfile({ nickname, status });
      }, 100);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // AuthContext's onAuthStateChanged listener will automatically detect the new user,
      // create their profile in Firestore using their Google display name,
      // and update the global state, which will unmount this modal automatically!
    } catch (e) {
      console.error("Google Auth Error", e);
      alert("שגיאה בהתחברות לחשבון גוגל");
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={`card glass-panel ${styles.modal}`}>
        <h2 className={styles.title}>ברוכים הבאים ל-MySpace! 👋</h2>
        <p className={styles.subtitle}>כדי להצטרף לאירוע, ספר לנו קצת על עצמך.</p>
        
        <button type="button" onClick={handleGoogleLogin} className={styles.btnPrimary} style={{ backgroundColor: '#fff', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem', border: '1px solid #ddd' }}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="24" height="24" />
          התחבר עם גוגל
        </button>
        
        <div style={{ textAlign: 'center', margin: '1rem 0', color: 'var(--text-secondary)' }}>או הזן פרטים ידנית:</div>
        
        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.formGroup}>
            <label>שם מלא:</label>
            <input 
              type="text" 
              required 
              placeholder="לדוגמה: ישראל ישראלי" 
              value={realName} 
              onChange={e => setRealName(e.target.value)} 
            />
          </div>
          <div className={styles.formGroup}>
            <label>מספר טלפון:</label>
            <input 
              type="tel" 
              required 
              placeholder="05X-XXXXXXX" 
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
            />
          </div>
          <div className={styles.formGroup}>
            <label>שם חיבה (אופציונלי):</label>
            <input 
              type="text" 
              placeholder="השם שיוצג לאורחים (לדוגמה: שרוליק)" 
              value={nickname} 
              onChange={e => setNickname(e.target.value)} 
            />
          </div>
          <div className={styles.formGroup}>
            <label>סטטוס (אופציונלי):</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <option value="hidden">שמור על פרטיות 🤫</option>
              <option value="single">רווק/ה 🌟</option>
              <option value="relationship">בזוגיות ❤️</option>
              <option value="married">נשוי/ה 💍</option>
              <option value="divorced">גרוש/ה 💔</option>
              <option value="widowed">אלמן/ה 🕊️</option>
              <option value="complicated">מסובך 🌀</option>
            </select>
          </div>
          
          <button type="submit" className={styles.btnPrimary}>הצטרף עכשיו!</button>
        </form>
      </div>
    </div>
  );
}

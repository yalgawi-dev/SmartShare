'use client';

import { useState } from 'react';
import { useAuth } from '../../app/context/AuthContext';
import styles from './RegistrationModal.module.css';

export default function RegistrationModal() {
  const { user, login, updateProfile, isLoaded } = useAuth();
  const [phone, setPhone] = useState('');
  const [realName, setRealName] = useState('');
  const [nickname, setNickname] = useState('');
  const [status, setStatus] = useState<any>('hidden');

  if (!isLoaded || user) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.trim() && realName.trim()) {
      login(phone, realName);
      // login occurs synchronously (simulated), so user will be set
      // update profile with extra fields after a short delay so context updates
      setTimeout(() => {
        updateProfile({ nickname, status });
      }, 100);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={`card glass-panel ${styles.modal}`}>
        <h2 className={styles.title}>ברוכים הבאים ל-SmartShare! 👋</h2>
        <p className={styles.subtitle}>כדי להצטרף לאירוע, ספר לנו קצת על עצמך.</p>
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
              <option value="complicated">מסובך 🌀</option>
            </select>
          </div>
          
          <button type="submit" className={styles.btnPrimary}>הצטרף עכשיו!</button>
        </form>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../app/context/AuthContext';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

export default function GlobalPhonePrompt() {
  const { user, isLoaded } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Only check once per session or if user explicitly dismisses
    const isDismissed = sessionStorage.getItem('phone_prompt_dismissed') === 'true';
    if (isLoaded && user && !user.phone && !isDismissed && !user.isAnonymous) {
      // Don't show immediately on load to prevent jumping, wait a sec
      const timer = setTimeout(() => setShowPrompt(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [user, isLoaded]);

  if (!showPrompt) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 9) return;
    
    setIsSubmitting(true);
    try {
      const db = getFirestore();
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { phone });
      
      setShowPrompt(false);
    } catch (error) {
      console.error('Error saving phone number', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('phone_prompt_dismissed', 'true');
    setShowPrompt(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'white', width: '90%', maxWidth: '400px', borderRadius: '24px', padding: '2.5rem 2rem', textAlign: 'center', animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', position: 'relative' }}>
        <button 
          onClick={handleDismiss}
          style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', fontSize: '1.5rem', color: '#94a3b8', cursor: 'pointer' }}
        >
          ✕
        </button>
        <div style={{ fontSize: '3rem', margin: '0 auto 1.5rem auto', width: '64px', height: '64px', background: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📱</div>
        
        <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a', textAlign: 'center', fontSize: '1.25rem' }}>השלמת פרטי התקשרות</h3>
        <p style={{ color: '#475569', marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: 1.5 }}>
          כדי שנוכל לעדכן אותך במקרה הצורך ולשמור על אבטחת חשבונך, נשמח אם תעדכן את מספר הטלפון שלך.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input 
            type="tel" 
            placeholder="05X-XXXXXXX" 
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '1.1rem', textAlign: 'center', direction: 'ltr' }}
            required
            disabled={isSubmitting}
          />
          <button 
            type="submit"
            disabled={isSubmitting || phone.length < 9}
            style={{ width: '100%', padding: '1rem', background: phone.length >= 9 ? 'var(--primary)' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 'bold', cursor: phone.length >= 9 ? 'pointer' : 'not-allowed', fontSize: '1.1rem', transition: '0.2s' }}
          >
            {isSubmitting ? 'שומר...' : 'שמור מספר טלפון'}
          </button>
        </form>
        
        <button 
          onClick={handleDismiss}
          style={{ width: '100%', padding: '0.75rem', background: 'transparent', color: '#64748b', border: 'none', fontWeight: '500', marginTop: '1rem', cursor: 'pointer', fontSize: '0.95rem' }}
        >
          אולי בפעם אחרת
        </button>
      </div>
    </div>
  );
}

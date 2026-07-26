'use client';

import { useState } from 'react';
import styles from './page.module.css';
import Link from 'next/link';

export const AVAILABLE_FEATURES = [
  { id: 'finance', name: 'התחשבנות וחשבוניות', desc: 'סריקת חשבוניות וחלוקת הוצאות בין שותפים', icon: '💰' },
  { id: 'cashbox', name: 'קופת מזומן', desc: 'העברות כספים וקופה קטנה משותפת', icon: '💵' },
  { id: 'vault', name: 'מסמכים ותוכניות', desc: 'אחסון מסמכים, תוכניות וקבצי PDF', icon: '📂' },
  { id: 'camera', name: 'מצלמת פרויקט', desc: 'צילום מסמכים ושטח ישירות מהנייד', icon: '📷' },
  { id: 'partners', name: 'שותפים לפרויקט', desc: 'ניהול חברי הפרויקט ואחוזי הבעלות', icon: '🤝' },
  { id: 'suppliers', name: 'ספקים ובעלי מקצוע', desc: 'ריכוז קבלנים ונותני שירות', icon: '👷‍♂️' },
  { id: 'gallery', name: 'גלריית תמונות', desc: 'העלאת תמונות משותפת', icon: '📸' },
  { id: 'journal', name: 'יומן מעקב', desc: 'תיעוד זמנים והערות ביומן', icon: '📝' },
];

import { useRouter } from 'next/navigation';
import { useSpaces } from '../../context/SpacesContext';

export default function CreateSpacePage() {
  const router = useRouter();
  const { addSpace } = useSpaces();
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [spaceName, setSpaceName] = useState('');

  const toggleFeature = (id: string) => {
    setSelectedFeatures(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const handleCreate = () => {
    if (!spaceName.trim()) {
      alert('יש להזין שם למרחב');
      return;
    }
    
    addSpace({
      title: spaceName,
      description: 'מרחב חדש שנוצר כעת',
      icon: '✨',
      features: selectedFeatures,
    });

    router.push('/');
  };

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.backBtn}>
        <span>&rarr;</span> חזרה ללוח הראשי
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>יצירת מרחב חדש</h1>
      </header>

      <div className={styles.formGroup}>
        <label className={styles.label}>שם המרחב (הפרויקט)</label>
        <input 
          type="text" 
          className={styles.input} 
          placeholder="לדוגמה: חופשה ביוון, בניית הבית..."
          value={spaceName}
          onChange={(e) => setSpaceName(e.target.value)}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>בחר אילו פיצ'רים להפעיל במרחב:</label>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1rem' }}>
          סמן את הכלים שתרצה שיהיו זמינים בפרויקט הזה. תוכל תמיד להוסיף או להסיר פיצ'רים מהרשימה הכללית בהמשך.
        </p>
        
        <div className={styles.featuresGrid}>
          {AVAILABLE_FEATURES.map(feature => {
            const isSelected = selectedFeatures.includes(feature.id);
            return (
              <div 
                key={feature.id} 
                className={`card ${styles.featureCard} ${isSelected ? styles.selected : ''}`}
                onClick={() => toggleFeature(feature.id)}
              >
                <div className={styles.featureHeader}>
                  <span className={styles.featureIcon}>{feature.icon}</span>
                  <span className={styles.featureName}>{feature.name}</span>
                </div>
                <p className={styles.featureDesc}>{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      <button className={styles.submitBtn} onClick={handleCreate}>
        צור מרחב חדש ({selectedFeatures.length} פיצ'רים נבחרו)
      </button>
    </div>
  );
}

'use client';

import { useState } from 'react';
import styles from './page.module.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSpaces } from '../../context/SpacesContext';
import { AVAILABLE_FEATURES } from '../../data/features';

const TEMPLATES = [
  { id: 'roommates', title: 'שותפים ומשק בית', desc: 'ניהול תקציב, הוצאות דירה, משימות ורשימות קניות.', icon: '🏠', features: ['finance', 'tasks', 'lists'] },
  { id: 'event', title: 'תכנון אירועים', desc: 'לארגון מסיבה, חתונה או אירוע חברה. ניהול מוזמנים (RSVP) והוצאות ספקים.', icon: '🎉', features: ['guests', 'finance', 'suppliers', 'tasks'] },
  { id: 'trip', title: 'תכנון טיול', desc: 'ארגון טיול משותף, מסלול יומי, קופה משותפת ושמירת כרטיסים.', icon: '✈️', features: ['finance', 'journal', 'vault'] },
  { id: 'construction', title: 'פרויקט בנייה / שיפוץ', desc: 'ניהול קבלנים, קופת מזומן, סריקת חשבוניות ותוכניות אדריכליות.', icon: '🏗️', features: ['finance', 'suppliers', 'vault', 'scanner', 'cashbox'] },
  { id: 'live', title: 'אירוע לייב (Live Media)', desc: 'מרחב ייעודי ליום האירוע למוזמנים בלבד: גלריית תמונות חיה וברכות.', icon: '📸', features: ['camera', 'gallery', 'guestbook'] },
  { id: 'custom', title: 'קיר מותאם אישית', desc: 'קיר חלק ונקי. בנה בעצמך והוסף ווידג\'טים מתוך רשימת הפיצ\'רים המלאה.', icon: '✨', features: [] }
];

export default function CreateSpacePage() {
  const router = useRouter();
  const { addSpace } = useSpaces();
  
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [spaceName, setSpaceName] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]); // Only used for custom

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setSpaceName(template.title); // Set default name to template title (editable by user)
      if (templateId !== 'custom') {
        setSelectedFeatures(template.features);
      } else {
        setSelectedFeatures([]);
      }
    }
  };

  const toggleCustomFeature = (featureId: string) => {
    setSelectedFeatures(prev => 
      prev.includes(featureId) ? prev.filter(f => f !== featureId) : [...prev, featureId]
    );
  };

  const handleCreate = () => {
    if (!spaceName.trim()) {
      alert('יש להזין שם למרחב');
      return;
    }
    
    const template = TEMPLATES.find(t => t.id === selectedTemplate);
    if (!template) return;

    addSpace({
      title: spaceName,
      description: template.id === 'custom' ? 'מרחב מותאם אישית' : `מרחב מבוסס על תבנית ${template.title}`,
      icon: template.icon,
      features: selectedFeatures,
    });

    router.push('/');
  };

  if (selectedTemplate) {
    const template = TEMPLATES.find(t => t.id === selectedTemplate);
    return (
      <div className={styles.container}>
        <button className={styles.backBtn} onClick={() => setSelectedTemplate(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
          <span>&rarr;</span> חזרה לבחירת תבנית
        </button>

        <header className={styles.header} style={{ marginTop: '2rem' }}>
          <h1 className={styles.title}>הגדרת מרחב: {template?.icon} {template?.title}</h1>
        </header>

        <div className={styles.formGroup}>
          <label className={styles.label}>שם המרחב (ניתן לעריכה)</label>
          <input 
            type="text" 
            className={styles.input} 
            value={spaceName}
            onChange={(e) => setSpaceName(e.target.value)}
          />
        </div>

        {template?.id === 'custom' && (
          <div className={styles.formGroup} style={{ marginTop: '2rem' }}>
            <label className={styles.label}>בחר ווידג'טים לקיר שלך:</label>
            <div className={styles.featuresGrid}>
              {AVAILABLE_FEATURES.map(feature => {
                const isSelected = selectedFeatures.includes(feature.id);
                return (
                  <div 
                    key={feature.id} 
                    className={`card ${styles.featureCard} ${isSelected ? styles.selected : ''}`}
                    onClick={() => toggleCustomFeature(feature.id)}
                  >
                    <div className={styles.featureHeader}>
                      <span className={styles.featureIcon}>{feature.icon}</span>
                      <span className={styles.featureName}>{feature.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {template?.id !== 'custom' && (
          <div className={styles.formGroup} style={{ marginTop: '2rem' }}>
            <label className={styles.label}>ווידג'טים שיופעלו אוטומטית בקיר:</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              {template?.features.map(fId => {
                const feature = AVAILABLE_FEATURES.find(f => f.id === fId);
                return (
                  <div key={fId} style={{ background: 'rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                    {feature?.icon} {feature?.name}
                  </div>
                )
              })}
            </div>
            <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#999' }}>
              * תמיד תוכל להוסיף ווידג'טים נוספים לקיר המרכזי מתוך מסך המרחב.
            </p>
          </div>
        )}

        <button className={styles.submitBtn} onClick={handleCreate} style={{ marginTop: '2rem' }}>
          צור מרחב והיכנס
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.backBtn}>
        <span>&rarr;</span> חזרה ללוח הראשי
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>בחר תבנית למרחב החדש</h1>
        <p style={{ color: '#aaa', marginTop: '0.5rem' }}>הקיר המרכזי יבנה אוטומטית בהתאם לתבנית שתבחר</p>
      </header>

      <div className={styles.featuresGrid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {TEMPLATES.map(template => (
          <div 
            key={template.id} 
            className={`card ${styles.featureCard}`}
            onClick={() => handleSelectTemplate(template.id)}
            style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            <div className={styles.featureHeader} style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
              <span className={styles.featureIcon} style={{ fontSize: '1.8rem' }}>{template.icon}</span>
              <span className={styles.featureName}>{template.title}</span>
            </div>
            <p className={styles.featureDesc} style={{ flex: 1 }}>{template.desc}</p>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '1rem' }}>
              {template.features.map(fId => {
                const f = AVAILABLE_FEATURES.find(feat => feat.id === fId);
                return f ? <span key={fId} style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{f.name}</span> : null;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

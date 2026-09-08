'use client';

import { useState } from 'react';
import styles from './page.module.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSpaces } from '../../context/SpacesContext';
import { AVAILABLE_FEATURES } from '../../data/features';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

const TEMPLATES = [
  { id: 'finance', title: 'ניהול הוצאות / התחשבנויות', desc: 'המרחב החכם לניהול תקציב, סריקת קבלות, והתחשבנויות שותפים.', icon: '💰', features: ['finance'] },
  { id: 'medical', title: 'תיק רפואי משפחתי (בקרוב)', desc: 'סיכומי מחלה, מעקב תרופות והפניות. מרוכז במקום אחד.', icon: '🩺', features: [] },
  { id: 'event', title: 'תכנון אירוע / חתונה (בקרוב)', desc: 'לארגון מסיבה, חתונה או אירוע חברה. ניהול מוזמנים (RSVP) והוצאות ספקים.', icon: '🎉', features: ['finance'] },
  { id: 'construction', title: 'פרויקט בנייה / שיפוץ (בקרוב)', desc: 'ניהול קבלנים, קופת מזומן, סריקת חשבוניות ותוכניות אדריכליות.', icon: '🏗️', features: ['finance'] },
  { id: 'custom', title: 'הרכב בעצמך (Custom)', desc: 'מרחב נקי. התחל מאפס והוסף כלי ניהול בהתאם לצורך שלך.', icon: '🧩', features: [] }
];

import { Suspense } from 'react';

export default function CreateSpacePage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>טוען...</div>}>
      <CreateSpaceContent />
    </Suspense>
  );
}

function CreateSpaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addSpace } = useSpaces();
  
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [spaceName, setSpaceName] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]); // Only used for custom

  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    const highlight = searchParams?.get('highlight');
    if (highlight && TEMPLATES.find(t => t.id === highlight)) {
      setHighlightedId(highlight);
      setTimeout(() => {
        const el = document.getElementById(`template-${highlight}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [searchParams]);

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
          <div className={styles.formGroup} style={{ marginTop: '2rem', animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-light)', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'float 3s ease-in-out infinite' }}>🧩</div>
              <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', fontSize: '1.4rem' }}>בונים מאפס (כמו פאזל!)</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.5', maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
                המרחב שלך ייווצר כדיור נקי וחלק. 
                מיד לאחר הכניסה, תוכל לגשת ל<strong>מחסן הכלים</strong> ולהדליק רק את הפיצ'רים שאתה באמת צריך (למשל: סורק מסמכים, ניהול משימות, ארכיון).
              </p>
              
              {/* Mini visual simulation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '12px', border: '1px dashed var(--border-light)', maxWidth: '300px', margin: '0 auto' }}>
                <div style={{ width: '100%', height: '40px', background: 'var(--bg-main)', borderRadius: '8px', opacity: 0.5 }}></div>
                <div style={{ width: '100%', height: '80px', background: 'var(--primary)', opacity: 0.2, borderRadius: '8px', border: '2px dashed var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 'bold' }}>
                  + הוסף כלי ניהול
                </div>
                <div style={{ width: '100%', height: '40px', background: 'var(--bg-main)', borderRadius: '8px', opacity: 0.5 }}></div>
              </div>
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
        {TEMPLATES.map(template => {
          const isHighlighted = highlightedId === template.id;
          const isDimmed = highlightedId && !isHighlighted;
          return (
            <div 
              key={template.id} 
              id={`template-${template.id}`}
              className={`card ${styles.featureCard}`}
              onClick={() => handleSelectTemplate(template.id)}
              style={{ 
                padding: '1.5rem', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.5rem',
                opacity: isDimmed ? 0.5 : 1,
                transform: isHighlighted ? 'scale(1.02)' : 'scale(1)',
                boxShadow: isHighlighted ? '0 0 0 3px var(--primary), 0 20px 40px rgba(99, 102, 241, 0.3)' : 'var(--shadow-sm)',
                transition: 'all 0.3s ease',
                position: 'relative'
              }}
            >
              {isHighlighted && (
                <div style={{ position: 'absolute', top: '-12px', right: '1rem', background: 'var(--primary)', color: 'white', padding: '0.2rem 0.8rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', animation: 'bounce 2s infinite' }}>
                  מומלץ עבורך! 👇
                </div>
              )}
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
          );
        })}
      </div>
    </div>
  );
}

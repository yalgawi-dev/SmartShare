"use client";
// @ts-nocheck

import { useState } from 'react';
import styles from './page.module.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSpaces } from '../../context/SpacesContext';
import { AVAILABLE_FEATURES } from '../../data/features';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

const TEMPLATES = [
  { 
    id: 'finance', 
    title: 'ניהול הוצאות / התחשבנויות', 
    desc: 'ניהול תקציב, סריקת קבלות וחלוקת הוצאות בין שותפים.', 
    examples: ['הוצאות שותפים', 'קבלות וחשבוניות', 'תקציב פרויקט'],
    icon: '💰', 
    features: ['finance', 'scanner', 'partners', 'vault', 'chat'] 
  },
  { 
    id: 'medical', 
    title: 'תיעוד מסמכים ותהליכים בזמן', 
    desc: 'ציר זמן חכם לסריקת מסמכים, סיכומי פגישות ושיתוף בעלי עניין.', 
    examples: ['תיק רפואי משפחתי', 'הצעות מחיר', 'חוזים והסכמים', 'אישורים ורשויות'],
    icon: '🗂️', 
    features: ['chat', 'partners', 'vault', 'scanner'] 
  },
  { 
    id: 'event', 
    title: 'תכנון אירוע / חתונה (בקרוב)', 
    desc: 'ניהול מוזמנים (RSVP), הוצאות ספקים ותיאום משותף.', 
    examples: ['חתונה / בר מצווה', 'אירוע חברה'],
    icon: '🎉', 
    features: ['finance'] 
  },
  { 
    id: 'construction', 
    title: 'פרויקט בנייה / שיפוץ (בקרוב)', 
    desc: 'ניהול קבלנים, סריקת חשבוניות ותוכניות אדריכליות.', 
    examples: ['שיפוץ דירה', 'קבלנים ואנשי מקצוע'],
    icon: '🏗️', 
    features: ['finance'] 
  },
  { 
    id: 'custom', 
    title: 'הרכב בעצמך (Custom)', 
    desc: 'מרחב נקי לגמרי. התחל מאפס והוסף כלים ממחסן הכלים.', 
    examples: ['התאמה אישית מלאה'],
    icon: '🧩', 
    features: [] 
  }
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

  const handleCreate = async () => {
    if (!spaceName.trim()) {
      alert('יש להזין שם למרחב');
      return;
    }
    
    const template = TEMPLATES.find(t => t.id === selectedTemplate);
    if (!template) return;

    const newId = await addSpace({
      title: spaceName,
      description: template.id === 'custom' ? 'מרחב מותאם אישית' : `מרחב מבוסס על תבנית ${template.title}`,
      icon: template.icon,
      features: selectedFeatures,
    } as any);

    router.push(`/?highlight=${newId}`);
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
              onFocus={(e) => { const t = e.target; setTimeout(() => t.select(), 50); }}
          />
        </div>

        {template?.id === 'custom' && (
          <div className={styles.formGroup} style={{ marginTop: '2rem', animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-light)', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'float 3s ease-in-out infinite' }}>🧩</div>
              <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', fontSize: '1.4rem' }}>מרחב חדש נבנה עבורך</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.5', maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
                המרחב שלך ייווצר כקיר נקי וחלק. 
                מיד לאחר הכניסה למרחב, תוכל לגשת ל<strong>מחסן הכלים</strong> ולהדליק רק את הפיצ'רים שאתה באמת צריך (למשל: סורק מסמכים, ניהול משימות, ארכיון שותפים ועוד).
              </p>
              
              {/* Mini visual simulation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', background: 'var(--bg-main)', padding: '1rem', borderRadius: '12px', border: '1px dashed var(--border-light)', maxWidth: '300px', margin: '0 auto' }}>
                <div style={{ width: '100%', height: '40px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-light)' }}></div>
                <div style={{ width: '100%', height: '80px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '2px dashed var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.1rem' }}>
                  ➕ מחסן הכלים
                </div>
                <div style={{ width: '100%', height: '40px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-light)' }}></div>
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

      <div className={styles.featuresGrid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem' }}>
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
                padding: '1.25rem', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between',
                minHeight: '260px',
                opacity: isDimmed ? 0.5 : 1,
                transform: isHighlighted ? 'scale(1.02)' : 'scale(1)',
                boxShadow: isHighlighted ? '0 0 0 3px var(--primary), 0 20px 40px rgba(99, 102, 241, 0.3)' : 'var(--shadow-sm)',
                transition: 'all 0.25s ease',
                position: 'relative',
                borderRadius: '16px',
                border: '1px solid var(--border-light)'
              }}
            >
              {isHighlighted && (
                <div style={{ position: 'absolute', top: '-10px', right: '1rem', background: 'var(--primary)', color: 'white', padding: '0.15rem 0.6rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  מומלץ עבורך! 👇
                </div>
              )}
              
              <div>
                <div className={styles.featureHeader} style={{ fontSize: '1.1rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span className={styles.featureIcon} style={{ fontSize: '1.6rem', lineHeight: 1 }}>{template.icon}</span>
                  <span className={styles.featureName} style={{ fontWeight: 'bold', fontSize: '1.05rem', lineHeight: 1.3 }}>{template.title}</span>
                </div>
                <p className={styles.featureDesc} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4', margin: '0.4rem 0 0.8rem 0' }}>
                  {template.desc}
                </p>
                
                {template.examples && template.examples.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.5rem' }}>
                    {template.examples.map((ex, i) => (
                      <span key={i} style={{ fontSize: '0.72rem', background: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary)', padding: '2px 7px', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                        • {ex}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.6rem', marginTop: 'auto' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: 600 }}>כלים מובנים:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {template.features.length > 0 ? template.features.map(fId => {
                    const f = AVAILABLE_FEATURES.find(feat => feat.id === fId);
                    return f ? (
                      <span key={fId} style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                        {f.icon} {f.name}
                      </span>
                    ) : null;
                  }) : (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>נבחרים עצמאית</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

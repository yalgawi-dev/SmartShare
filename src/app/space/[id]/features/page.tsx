'use client';

import { use } from 'react';
import styles from './page.module.css';
import Link from 'next/link';
import { useSpaces } from '../../../context/SpacesContext';
import { AVAILABLE_FEATURES } from '../../../data/features';

export default function ManageFeaturesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { spaces, toggleFeature } = useSpaces();
  
  const space = spaces.find(s => s.id === id);

  if (!space) {
    return <div className={styles.container}><h1>הפרויקט לא נמצא.</h1></div>;
  }

  const handleRemove = (featureId: string, featureName: string) => {
    const confirmDelete = window.confirm(`האם אתה בטוח שברצונך להסיר את הפיצ'ר "${featureName}" מהמרחב?`);
    if (confirmDelete) {
      toggleFeature(id, featureId);
    }
  };

  const handleAdd = (featureId: string) => {
    toggleFeature(id, featureId);
  };

  return (
    <div className={styles.container}>
      <Link href={`/space/${id}`} className={styles.backBtn}>
        <span>&rarr;</span> חזרה למרחב {space.title}
      </Link>

      <header className={styles.header}>
        <h1 className={styles.title}>ניהול פיצ'רים</h1>
        <p className={styles.subtitle}>הוסף או הסר כלים מהמרחב "{space.title}"</p>
      </header>

      <div className={styles.featuresList}>
        {AVAILABLE_FEATURES.map(feature => {
          const isSelected = space.features.includes(feature.id);
          
          return (
            <div key={feature.id} className={`${styles.featureRow} ${isSelected ? styles.selectedRow : ''}`}>
              <div className={styles.featureInfo}>
                <span className={styles.featureIcon}>{feature.icon}</span>
                <div>
                  <h3 className={styles.featureName}>{feature.name}</h3>
                  <p className={styles.featureDesc}>{feature.desc}</p>
                </div>
              </div>
              
              <div className={styles.featureAction}>
                {isSelected ? (
                  <button 
                    className={`${styles.actionBtn} ${styles.removeBtn}`}
                    onClick={() => handleRemove(feature.id, feature.name)}
                  >
                    הסרה
                  </button>
                ) : (
                  <button 
                    className={`${styles.actionBtn} ${styles.addBtn}`}
                    onClick={() => handleAdd(feature.id)}
                  >
                    שיוך למרחב
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import styles from './page.module.css';
import Link from 'next/link';
import { useSpaces } from './context/SpacesContext';
import { getFeatureById } from './data/features';

export default function Dashboard() {
  const { spaces } = useSpaces();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>המרחבים שלי</h1>
          <p className={styles.subtitle}>בחר פרויקט כדי להמשיך או צור מרחב חדש</p>
        </div>
        <Link href="/space/new" className={styles.createBtn}>
          <span>+</span> מרחב חדש
        </Link>
      </header>

      <div className={styles.grid}>
        {spaces.map(space => (
          <Link href={`/space/${space.id}`} key={space.id}>
            <div className={`card ${styles.projectCard} glass-panel`}>
              <div className={styles.projectHeader}>
                <div className={styles.projectIcon}>{space.icon}</div>
              </div>
              <h2 className={styles.projectTitle}>{space.title}</h2>
              <p className={styles.projectDesc}>{space.description}</p>
              
              <div className={styles.badges}>
                {space.features.slice(0, 3).map(fId => {
                  const feature = getFeatureById(fId);
                  return feature ? <span key={fId} className={styles.badge}>{feature.name}</span> : null;
                })}
                {space.features.length > 3 && (
                  <span className={styles.badge}>+{space.features.length - 3}</span>
                )}
              </div>

              <div className={styles.projectFooter}>
                <span>עודכן: {space.updatedAt}</span>
                <span>{space.features.length} פיצ'רים</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

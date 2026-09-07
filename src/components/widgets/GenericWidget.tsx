'use client';

import { doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useState } from 'react';

export default function GenericWidget({ spaceId, feature, title, description, icon, onRemove }: any) {
  const [removing, setRemoving] = useState(false);

  const displayTitle = feature?.title || title || 'פיצ׳ר עתידי';
  const displayDesc = feature?.desc || description || 'בווידג׳ט זה תוכלו לנהל כלים נוספים.';
  const displayIcon = feature?.icon || icon || '✨';

  const handleRemove = async () => {
    if (onRemove) {
      onRemove();
      return;
    }
    if (spaceId && feature?.id) {
      setRemoving(true);
      try {
        await updateDoc(doc(db, 'spaces', spaceId), {
          features: arrayRemove(feature.id)
        });
      } catch (err) {
        console.error('Error removing widget:', err);
        setRemoving(false);
      }
    }
  };

  if (removing) return null;

  return (
    <div className="card glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', background: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px dashed var(--primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ fontSize: '2rem' }}>{displayIcon}</div>
        <div>
          <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>{displayTitle} <span style={{ fontSize: '0.8rem', background: 'var(--bg-hover)', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', marginLeft: '0.5rem' }}>בפיתוח</span></h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            {displayDesc} - הווידג׳ט המלא יתווסף בקרוב.
          </p>
        </div>
      </div>
      <button 
        onClick={handleRemove}
        disabled={removing}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-secondary)' }}
        title="הסר פיצ'ר מהקיר"
      >
        ✖
      </button>
    </div>
  );
}

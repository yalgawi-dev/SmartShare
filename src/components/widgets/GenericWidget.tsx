'use client';

export default function GenericWidget({ title, description, icon, onRemove }: { title: string, description: string, icon: string, onRemove: () => void }) {
  return (
    <div className="card glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', background: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px dashed var(--primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ fontSize: '2rem' }}>{icon}</div>
        <div>
          <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>{title} <span style={{ fontSize: '0.8rem', background: 'var(--bg-hover)', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', marginLeft: '0.5rem' }}>בפיתוח</span></h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            {description} - הווידג'ט המלא יתווסף בקרוב.
          </p>
        </div>
      </div>
      <button 
        onClick={onRemove}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-secondary)' }}
        title="הסר פיצ'ר מהקיר"
      >
        ✕
      </button>
    </div>
  );
}

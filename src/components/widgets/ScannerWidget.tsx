'use client';

export default function ScannerWidget() {
  return (
    <div className="card glass-panel" style={{ padding: '2rem', marginBottom: '2rem', background: 'var(--bg-card)', border: '2px dashed var(--primary)', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📠</div>
      <h3 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>סורק מסמכים פעיל</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
        סרוק חשבוניות ומסמכים רשמיים, המערכת תפענח אותם ותשמור אותם בבטחה.
      </p>
      <button style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem 2rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
        📷 הפעל סורק
      </button>
    </div>
  );
}

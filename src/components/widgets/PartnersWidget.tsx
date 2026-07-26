'use client';

export default function PartnersWidget({ activePartnersCount }: { activePartnersCount: number }) {
  
  const handleInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'הצטרף למרחב שלי ב-SmartShare',
          text: 'היי! אני מזמין אותך להצטרף אלי למרחב העבודה המשותף שלנו.',
          url: window.location.href,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      alert('אפשרות השיתוף אינה נתמכת בדפדפן זה. העתק את הקישור במקום.');
    }
  };

  return (
    <div className="card glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', background: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ fontSize: '2rem' }}>🤝</div>
        <div>
          <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)' }}>שותפים לפרויקט</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            {activePartnersCount === 0 
              ? 'טרם הזמנת שותפים לפרויקט זה.' 
              : `ישנם ${activePartnersCount} שותפים פעילים במרחב.`}
          </p>
        </div>
      </div>
      <button 
        onClick={handleInvite}
        style={{ background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)', padding: '0.5rem 1.5rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer' }}
      >
        + הזמן שותפים
      </button>
    </div>
  );
}

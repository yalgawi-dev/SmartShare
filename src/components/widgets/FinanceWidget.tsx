'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSpaces } from '../../app/context/SpacesContext';

export default function FinanceWidget({ space, activePartnersCount, onRemove, initialScannedImage }: { space: any, activePartnersCount: number, onRemove?: () => void, initialScannedImage?: string | null }) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'dispute' | 'missing'>('all');
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const { addInvoice } = useSpaces();

  // If a scan arrives from the parent (ScannerWidget), open the modal and attach it
  useEffect(() => {
    if (initialScannedImage) {
      setScannedImage(initialScannedImage);
      setIsAddingExpense(true);
    }
  }, [initialScannedImage]);
  
  const hasScanner = space.features.includes('scanner');
  const invoices = space.invoices || [];

  const filteredInvoices = invoices.filter((inv: any) => filter === 'all' || inv.status === filter);
  const totalExpenses = invoices.reduce((acc: number, inv: any) => acc + (inv.amount || 0), 0);

  const handleAddExpense = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const supplier = formData.get('supplier') as string;
    const category = formData.get('category') as string;

    addInvoice(space.id, {
      amount,
      supplier,
      category,
      payerName: 'דני (אני)', // Hardcoded for now until Auth is built
      date: new Date().toLocaleDateString('he-IL'),
      status: 'pending',
      note: '',
      approvalsNeeded: activePartnersCount > 0 ? activePartnersCount : 0,
      approvalsReceived: 0,
      vatRate: space.settings?.defaultVatRate || 18,
      hasAttachment: !!scannedImage
    });

    setIsAddingExpense(false);
    setScannedImage(null);
  };

  return (
    <div className="card glass-panel" style={{ padding: '2rem', marginBottom: '2rem', background: 'var(--bg-card)', position: 'relative' }}>
      
      {/* Add Expense Modal */}
      {isAddingExpense && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.95)', zIndex: 10, borderRadius: 'inherit', display: 'flex', flexDirection: 'column', padding: '2rem', backdropFilter: 'blur(5px)' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem' }}>➕ הוספת הוצאה חדשה</h3>
          <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
            <input required name="supplier" placeholder="שם הספק / תיאור" style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-light)' }} />
            <input required name="amount" type="number" placeholder="סכום (₪)" style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-light)' }} />
            <select required name="category" style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
              <option value="כללי">כללי</option>
              <option value="חומרי בניין">חומרי בניין</option>
              <option value="קבלנים">קבלנים</option>
              <option value="חשמל">חשמל</option>
              <option value="ריהוט">ריהוט</option>
            </select>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" style={{ flex: 1, background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>שמור הוצאה</button>
              <button type="button" onClick={() => { setIsAddingExpense(false); setScannedImage(null); }} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-light)', padding: '0.75rem', borderRadius: '4px', cursor: 'pointer' }}>ביטול</button>
            </div>
          </form>
          {scannedImage && (
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>מסמך מצורף (נסרק בהצלחה):</p>
              <img src={scannedImage} alt="Scanned Attachment" style={{ maxWidth: '100%', maxHeight: '250px', border: '1px solid var(--border-light)', borderRadius: '8px' }} />
            </div>
          )}
        </div>
      )}

      {/* Header and Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              💰 התחשבנות
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              ניהול הוצאות {activePartnersCount > 0 ? 'ומאזן שותפים' : 'אישי'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href={`/space/${space.id}/reports`} style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none', padding: '0.5rem 1rem', border: '1px solid var(--primary)', borderRadius: 'var(--radius-full)' }}>
            📊 דוחות וייצוא
          </Link>
          <button 
            onClick={() => setIsAddingExpense(true)}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer' }}
          >
            + הוסף הוצאה
          </button>
          {onRemove && (
            <button 
              onClick={onRemove}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-secondary)' }}
              title="הסר פיצ'ר מהקיר"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Summary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>סך כל ההוצאות</p>
          <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '2rem', color: 'var(--text-primary)' }}>₪{totalExpenses.toLocaleString()}</h3>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>חשבוניות מחכות לאישור</p>
          <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '2rem', color: '#f59e0b' }}>{invoices.filter((i: any) => i.status === 'pending').length}</h3>
        </div>
        {activePartnersCount > 0 && (
          <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>מאזן שלך (חוב/זכות)</p>
            <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '2rem', color: '#10b981' }}>+₪0</h3>
          </div>
        )}
      </div>

      {!hasScanner && (
        <div style={{ padding: '1rem', background: '#fff3cd', color: '#856404', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid #ffeeba' }}>
          <span style={{ fontSize: '1.25rem' }}>💡</span>
          <div>
            <strong>טיפ:</strong> רוב המשתמשים מצרפים את פיצ'ר ה-<strong>סורק חשבוניות</strong> כדי למנוע אובדן קבלות ולהאיץ את ההקלדה. הוסף אותו מהתפריט הצדדי.
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        <button onClick={() => setFilter('all')} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-light)', background: filter === 'all' ? 'var(--bg-hover)' : 'transparent', fontWeight: filter === 'all' ? 'bold' : 'normal', cursor: 'pointer' }}>
          הכל
        </button>
        <button onClick={() => setFilter('pending')} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-light)', background: filter === 'pending' ? 'var(--bg-hover)' : 'transparent', fontWeight: filter === 'pending' ? 'bold' : 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          ממתין לאישור
          <span style={{ background: '#f59e0b', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
            {invoices.filter((i: any) => i.status === 'pending').length}
          </span>
        </button>
      </div>

      {filteredInvoices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          לא נמצאו חשבוניות שתואמות לסינון.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredInvoices.map((inv: any) => (
            <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ 
                  width: '40px', height: '40px', 
                  borderRadius: '50%', 
                  background: inv.status === 'approved' ? '#d1fae5' : inv.status === 'pending' ? '#fef3c7' : '#fee2e2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.25rem'
                }}>
                  {inv.status === 'approved' ? '✓' : inv.status === 'pending' ? '⏳' : '⚠️'}
                </div>
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {inv.supplier}
                    {inv.hasAttachment ? (
                      <span title="מצורפת חשבונית" style={{ fontSize: '1rem' }}>📎</span>
                    ) : (
                      <span title="חסר מסמך/קבלה" style={{ fontSize: '1rem', color: '#ef4444' }}>⚠️</span>
                    )}
                  </h4>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span>{inv.date}</span>
                    <span>• שולם ע"י: {inv.payerName}</span>
                    {inv.category && <span>• {inv.category}</span>}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'left' }}>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                  ₪{inv.amount?.toLocaleString()}
                </h3>
                {activePartnersCount > 0 && inv.status === 'pending' && (
                  <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 'bold' }}>
                    {inv.approvalsReceived} / {inv.approvalsNeeded} אישורים
                  </div>
                )}
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}

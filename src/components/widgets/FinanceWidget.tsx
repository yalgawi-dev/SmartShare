'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSpaces } from '../../app/context/SpacesContext';

export default function FinanceWidget({ space, activePartnersCount, onRemove, initialScannedImage }: { space: any, activePartnersCount: number, onRemove?: () => void, initialScannedImage?: string | null }) {
  const [activeTab, setActiveTab] = useState<'summary' | 'transactions'>('transactions');
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
    setActiveTab('transactions'); // Move to transactions so they see the newly added item at the top!
  };

  return (
    <div className="card glass-panel" style={{ padding: '0', marginBottom: '2rem', background: 'var(--bg-card)', position: 'relative', overflow: 'hidden' }}>
      
      {/* Header and Controls */}
      <div style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              💰 התחשבנות
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              ניהול הוצאות {activePartnersCount > 0 ? 'ומאזן שותפים' : 'אישי'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link href={`/space/${space.id}/reports`} style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none', padding: '0.5rem 1rem', border: '1px solid var(--primary)', borderRadius: 'var(--radius-full)', fontSize: '0.9rem' }}>
              📊 דוחות
            </Link>
            {onRemove && (
              <button 
                onClick={onRemove}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-secondary)', padding: '0.5rem' }}
                title="הסר פיצ'ר מהקיר"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', marginTop: '1rem' }}>
        <button 
          onClick={() => setActiveTab('transactions')}
          style={{ flex: 1, padding: '1rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'transactions' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'transactions' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'transactions' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1rem' }}
        >
          פעולות אחרונות
        </button>
        <button 
          onClick={() => setActiveTab('summary')}
          style={{ flex: 1, padding: '1rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'summary' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'summary' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'summary' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1rem' }}
        >
          סיכום ותקציב
        </button>
      </div>

      <div style={{ padding: '1.5rem' }}>
        {activeTab === 'summary' && (
          <div>
            {/* Summary Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>סך הכל שולם</p>
                <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: 'var(--text-primary)' }}>₪{totalExpenses.toLocaleString()}</h3>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ממתין לאישור</p>
                <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: '#f59e0b' }}>{invoices.filter((i: any) => i.status === 'pending').length}</h3>
              </div>
              {activePartnersCount > 0 && (
                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>מאזן אישי</p>
                  <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: '#10b981' }}>+₪0</h3>
                </div>
              )}
            </div>

            {!hasScanner && (
              <div style={{ padding: '1rem', background: '#fff3cd', color: '#856404', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', border: '1px solid #ffeeba' }}>
                <span style={{ fontSize: '1.25rem' }}>💡</span>
                <div style={{ fontSize: '0.9rem' }}>
                  <strong>טיפ:</strong> רוב המשתמשים מצרפים את פיצ'ר ה-<strong>סורק חשבוניות</strong> כדי למנוע אובדן קבלות ולהאיץ את ההקלדה.
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'transactions' && (
          <div>
            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
              <button onClick={() => setFilter('all')} style={{ padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-light)', background: filter === 'all' ? 'var(--bg-hover)' : 'transparent', fontWeight: filter === 'all' ? 'bold' : 'normal', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                הכל
              </button>
              <button onClick={() => setFilter('pending')} style={{ padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-light)', background: filter === 'pending' ? 'var(--bg-hover)' : 'transparent', fontWeight: filter === 'pending' ? 'bold' : 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                ממתין لاישור
                {invoices.filter((i: any) => i.status === 'pending').length > 0 && (
                  <span style={{ background: '#f59e0b', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                    {invoices.filter((i: any) => i.status === 'pending').length}
                  </span>
                )}
              </button>
            </div>

            {filteredInvoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📄</span>
                לא נמצאו חשבוניות. לחץ על ה-➕ כדי להוסיף.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* REVERSE CHRONOLOGICAL ORDER (Newest on top) */}
                {[...filteredInvoices].reverse().map((inv: any) => (
                  <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ 
                        width: '40px', height: '40px', flexShrink: 0,
                        borderRadius: '50%', 
                        background: inv.status === 'approved' ? '#d1fae5' : inv.status === 'pending' ? '#fef3c7' : '#fee2e2',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.1rem'
                      }}>
                        {inv.status === 'approved' ? '✓' : inv.status === 'pending' ? '⏳' : '⚠️'}
                      </div>
                      <div>
                        <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {inv.supplier}
                          {inv.hasAttachment ? (
                            <span title="מצורפת חשבונית" style={{ fontSize: '0.9rem' }}>📎</span>
                          ) : (
                            <span title="חסר מסמך/קבלה" style={{ fontSize: '0.9rem', color: '#ef4444' }}>⚠️</span>
                          )}
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <span>{inv.date}</span>
                          <span>• ע"י {inv.payerName}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'left', flexShrink: 0 }}>
                      <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                        ₪{inv.amount?.toLocaleString()}
                      </h3>
                      {activePartnersCount > 0 && inv.status === 'pending' && (
                        <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 'bold' }}>
                          {inv.approvalsReceived}/{inv.approvalsNeeded} אושר
                        </div>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAB - Floating Action Button for adding expense */}
      <button 
        className="fab"
        onClick={() => setIsAddingExpense(true)}
        style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem', width: '50px', height: '50px' }} 
      >
        ➕
      </button>

      {/* Add Expense Modal (Bottom Sheet Style) */}
      {isAddingExpense && (
        <>
          <div className="bottom-sheet-overlay" onClick={() => setIsAddingExpense(false)} style={{ position: 'absolute' }}></div>
          <div className="bottom-sheet" style={{ position: 'absolute' }}> 
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>הוספת הוצאה חדשה</h3>
              <button onClick={() => setIsAddingExpense(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-secondary)' }}>✕</button>
            </div>
            
            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input required name="supplier" placeholder="שם הספק / תיאור" style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)' }} />
              <input required name="amount" type="number" placeholder="סכום (₪)" style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)' }} />
              <select required name="category" style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)' }}>
                <option value="כללי">כללי</option>
                <option value="חומרי בניין">חומרי בניין</option>
                <option value="קבלנים">קבלנים</option>
                <option value="חשמל">חשמל</option>
                <option value="ריהוט">ריהוט</option>
              </select>
              <div style={{ marginTop: '0.5rem' }}>
                <button type="submit" style={{ width: '100%', background: 'var(--primary)', color: 'white', border: 'none', padding: '1rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>
                  שמור הוצאה
                </button>
              </div>
            </form>
            {scannedImage && (
              <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>מסמך מצורף (נסרק בהצלחה):</p>
                <img src={scannedImage} alt="Scanned Attachment" style={{ maxWidth: '100%', maxHeight: '200px', border: '1px solid var(--border-light)', borderRadius: '12px', objectFit: 'contain' }} />
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
}

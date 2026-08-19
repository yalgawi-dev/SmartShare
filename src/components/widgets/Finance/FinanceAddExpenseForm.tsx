import React from 'react';
import ScannerModal from '../ScannerModal';

interface FinanceAddExpenseFormProps {
  user: any;
  validMembers: any[];
  activePartnersCount: number;
  ocrData: any;
  scannedImage: string | null;
  isAnalyzing: boolean;
  ocrElapsedTime: number;
  ocrDebugMessage: string | null;
  handleAddExpense: (e: React.FormEvent<HTMLFormElement>) => void;
  handleCloseForm: () => void;
  isScanning: boolean;
  setIsScanning: (val: boolean) => void;
  runOcrPipeline: (imgUrl: string) => void;
  setPreviewImage: (url: string | null) => void;
  selectedPayerId: string;
  setSelectedPayerId: (val: string) => void;
  selectedCategory: string;
  setSelectedCategory: (val: string) => void;
}

export function FinanceAddExpenseForm({
  user,
  validMembers,
  activePartnersCount,
  ocrData,
  scannedImage,
  isAnalyzing,
  ocrElapsedTime,
  ocrDebugMessage,
  handleAddExpense,
  handleCloseForm,
  isScanning,
  setIsScanning,
  runOcrPipeline,
  setPreviewImage,
  selectedPayerId,
  setSelectedPayerId,
  selectedCategory,
  setSelectedCategory
}: FinanceAddExpenseFormProps) {
  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .scanner-fab-button { display: none !important; }
      `}} />
      <div className="bottom-sheet-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)' }}></div>
      <div className="bottom-sheet" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1001, background: 'var(--bg-card)', padding: '2rem', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 -10px 40px rgba(0,0,0,0.2)' }}> 
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>הוספת הוצאה חדשה</h3>
          <button type="button" onClick={handleCloseForm} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
        </div>
        
        <form key={JSON.stringify(ocrData) + (scannedImage || 'new-expense')} onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '100%' }}>

          {isAnalyzing && (
            <div style={{ padding: '1.5rem', background: 'var(--bg-main)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '3rem', animation: 'bounce 1s infinite' }}>🤖</div>
              <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>מפענח את הקבלה...</div>
              <div style={{ fontSize: '1.5rem', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 'bold' }}>
                {ocrElapsedTime.toFixed(1)}s
              </div>
              <style>
                {`
                  @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                  }
                `}
              </style>
            </div>
          )}
          
          {!isAnalyzing && scannedImage && ocrElapsedTime > 0 && !ocrDebugMessage && ocrData._debug && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#ecfdf5', borderRadius: '0.5rem', border: '1px solid #10b981' }}>
              <h4 style={{ color: '#047857', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 600 }}>⏱️ נתוני ביצועים (OCR)</h4>
              <table style={{ width: '100%', fontSize: '0.85rem', color: '#065f46', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.25rem 0' }}>סה"כ זמן פענוח:</td>
                    <td style={{ fontWeight: 'bold', textAlign: 'left', padding: '0.25rem 0' }}>{((ocrData._debug.aiTimeMs || 0) / 1000).toFixed(2)} שניות</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0', borderTop: '1px solid #6ee7b7' }}>מתוכם ניתוח נקי (Google AI):</td>
                    <td style={{ textAlign: 'left', padding: '0.25rem 0', borderTop: '1px solid #6ee7b7' }}>{((ocrData._debug.pureInferenceMs || ocrData._debug.aiTimeMs || 0) / 1000).toFixed(2)} שניות</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0' }}>מתוכם זמני המתנה פסיבית (503):</td>
                    <td style={{ textAlign: 'left', padding: '0.25rem 0' }}>{((ocrData._debug.totalWaitMs || 0) / 1000).toFixed(2)} שניות ({ocrData._debug.retryCount || 0} ניסיונות)</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0', borderTop: '1px solid #6ee7b7' }}>העלאה, רשת ועיבוד השרת שלנו:</td>
                    <td style={{ textAlign: 'left', padding: '0.25rem 0', borderTop: '1px solid #6ee7b7' }}>{Math.max(0, ((Number(ocrData._debug.totalTimeMs) || 0) - (Number(ocrData._debug.aiTimeMs) || 0)) / 1000).toFixed(2)} שניות</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {ocrDebugMessage && (
            <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '12px', border: '1px solid #f87171', fontSize: '0.9rem', whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left' }}>
              {ocrDebugMessage}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>שם העסק / תיאור</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input required name="supplier" defaultValue={ocrData.vendor || ''} placeholder="שם הספק / תיאור" style={{ flex: 1, padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)', color: 'var(--text-primary)', width: '100%' }} />
              {!scannedImage && (
                <button type="button" onClick={() => setIsScanning(true)} style={{ background: 'var(--bg-main)', color: 'var(--text-primary)', border: '2px solid var(--border-light)', padding: '0 1rem', borderRadius: '12px', cursor: 'pointer', fontSize: '1.5rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="סרוק חשבונית">
                  📷
                </button>
              )}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>סכום כולל מע״מ (₪)</label>
              <input required name="amount" type="number" step="0.01" defaultValue={ocrData.amount || ''} placeholder="סכום כולל מע״מ" style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)', color: 'var(--text-primary)' }} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>תאריך</label>
              <input required name="date" type="date" defaultValue={ocrData.date || new Date().toISOString().split('T')[0]} style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>מס' חשבונית (אופציונלי)</label>
              <input name="invoiceNumber" defaultValue={ocrData.invoiceNumber || ''} placeholder="מספר מסמך" style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)', color: 'var(--text-primary)' }} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>ח.פ / ע.מ (אופציונלי)</label>
              <input name="vatNumber" defaultValue={ocrData.vatNumber || ''} placeholder="מספר תאגיד" style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          
          {activePartnersCount > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <select 
                required 
                value={selectedPayerId} 
                onChange={e => setSelectedPayerId(e.target.value)}
                style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)' }}
              >
                <option value={user?.id || 'me'}>{user?.realName || 'אני'}</option>
                {validMembers.map((m: any) => (
                  <option key={m.userId} value={m.userId}>{m.name}</option>
                ))}
                <option value="other">אחר (הקלד שם)...</option>
              </select>
              {selectedPayerId === 'other' && (
                <input 
                  required 
                  name="payerNameCustom" 
                  placeholder="הקלד שם איש קשר..." 
                  style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--primary)', fontSize: '1rem', background: '#fff' }} 
                />
              )}
            </div>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <select 
              required 
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)' }}
            >
              <option value="כללי">כללי</option>
              <option value="חומרי בניין">חומרי בניין</option>
              <option value="קבלנים">קבלנים</option>
              <option value="חשמל">חשמל</option>
              <option value="ריהוט">ריהוט</option>
              <option value="other">אחר (הקלד קטגוריה)...</option>
            </select>
            {selectedCategory === 'other' && (
              <input 
                required 
                name="categoryCustom" 
                placeholder="הקלד קטגוריה..." 
                style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--primary)', fontSize: '1rem', background: '#fff' }} 
              />
            )}
          </div>
          
          <textarea name="note" placeholder="הערות (אופציונלי)" rows={2} style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)', resize: 'vertical' }}></textarea>
          
          <div style={{ marginTop: '0.5rem' }}>
            <button type="submit" style={{ width: '100%', background: 'var(--primary)', color: 'white', border: 'none', padding: '1rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>
              שמור הוצאה
            </button>
          </div>
        </form>
        {isScanning && (
          <ScannerModal 
            onClose={() => setIsScanning(false)}
            onComplete={runOcrPipeline}
          />
        )}
        {scannedImage && (
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>מסמך מצורף (נסרק בהצלחה):</p>
            <img 
              src={scannedImage} 
              alt="Scanned Attachment" 
              onClick={() => setPreviewImage(scannedImage)}
              style={{ maxWidth: '100%', maxHeight: '200px', border: '1px solid var(--border-light)', borderRadius: '12px', objectFit: 'contain', cursor: 'zoom-in' }} 
            />
          </div>
        )}
        {isAnalyzing && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes pulsebot { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
            `}} />
            <div style={{ fontSize: '4rem', marginBottom: '1rem', animation: 'pulsebot 1.5s infinite' }}>🤖</div>
            <h2 style={{ margin: 0 }}>מפענח נתונים...</h2>
            <p style={{ marginTop: '0.5rem', opacity: 0.8 }}>קורא את החשבונית בעזרת בינה מלאכותית</p>
          </div>
        )}
      </div>
    </>
  );
}

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
  const [formValues, setFormValues] = React.useState({
    supplier: ocrData?.vendor || '',
    amount: ocrData?.amount || '',
    vatAmount: ocrData?.vatAmount || '',
    date: ocrData?.date || new Date().toISOString().split('T')[0]
  });

  React.useEffect(() => {
    if (ocrData) {
      setFormValues({
        supplier: ocrData.vendor || '',
        amount: ocrData.amount || '',
        vatAmount: ocrData.vatAmount || '',
        date: ocrData.date || new Date().toISOString().split('T')[0]
      });
    }
  }, [ocrData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const isFormValid = formValues.supplier.trim() !== '' && formValues.amount.toString().trim() !== '' && formValues.date.trim() !== '';

  const renderSmartInput = (name: string, type: string, label: string, placeholder: string, value: string | number, aiExtracted: boolean, required = false, step?: string) => {
    const isMissing = required && !value && scannedImage && !isAnalyzing;
    
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
        <label style={{ fontSize: '0.85rem', color: isMissing ? '#ef4444' : 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
          <span>{label} {required && '*'}</span>
          {aiExtracted && <span title="זוהה אוטומטית ע״י AI" style={{ color: '#10b981', fontSize: '0.9rem' }}>✨ תואם למקור</span>}
        </label>
        <div style={{ position: 'relative' }}>
          <input 
            required={required} 
            name={name} 
            type={type} 
            step={step}
            value={value}
            onChange={handleChange}
            placeholder={placeholder} 
            style={{ 
              width: '100%', 
              padding: '0.875rem', 
              borderRadius: '12px', 
              border: isMissing ? '2px solid #ef4444' : (aiExtracted ? '2px solid #10b981' : '1px solid var(--border-light)'), 
              fontSize: '1rem', 
              background: isMissing ? '#fef2f2' : (aiExtracted ? '#ecfdf5' : 'rgba(0,0,0,0.02)'), 
              color: 'var(--text-primary)',
              transition: 'all 0.2s ease'
            }} 
          />
        </div>
        {isMissing && <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.25rem' }}>⚠️ חסר נתון, אנא השלם</span>}
      </div>
    );
  };

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
                    <td style={{ padding: '0.25rem 0' }}>סה"כ זמן המתנה (לקוח):</td>
                    <td style={{ fontWeight: 'bold', textAlign: 'left', padding: '0.25rem 0' }}>{ocrElapsedTime.toFixed(2)} שניות</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0', borderTop: '1px solid #6ee7b7' }}>מתוכם ניתוח נקי (Google AI):</td>
                    <td style={{ textAlign: 'left', padding: '0.25rem 0', borderTop: '1px solid #6ee7b7' }}>{((ocrData._debug.pureInferenceMs || ocrData._debug.aiTimeMs || 0) / 1000).toFixed(2)} שניות</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0' }}>מתוכם קריאות שבוטלו (Google Hang):</td>
                    <td style={{ textAlign: 'left', padding: '0.25rem 0' }}>{((ocrData._debug.abortedTimeMs || 0) / 1000).toFixed(2)} שניות</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0' }}>מתוכם השהיית עומסים בצד שרת:</td>
                    <td style={{ textAlign: 'left', padding: '0.25rem 0' }}>{((ocrData._debug.totalWaitMs || 0) / 1000).toFixed(2)} שניות ({ocrData._debug.retryCount || 0} ניסיונות)</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0', borderTop: '1px solid #6ee7b7' }}>העלאה, רשת ופערים (הצד שלנו):</td>
                    <td style={{ textAlign: 'left', padding: '0.25rem 0', borderTop: '1px solid #6ee7b7' }}>{Math.max(0, ocrElapsedTime - ((Number(ocrData._debug.aiTimeMs) || 0) / 1000)).toFixed(2)} שניות</td>
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
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              {renderSmartInput('supplier', 'text', 'שם העסק / תיאור', 'שם הספק / תיאור', formValues.supplier, !!ocrData.vendor, true)}
              {!scannedImage && (
                <button type="button" onClick={() => setIsScanning(true)} style={{ background: 'var(--bg-main)', color: 'var(--text-primary)', border: '2px solid var(--border-light)', padding: '0 1rem', height: '52px', borderRadius: '12px', cursor: 'pointer', fontSize: '1.5rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="סרוק חשבונית">
                  📷
                </button>
              )}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            {renderSmartInput('amount', 'number', 'סכום כולל מע״מ (₪)', 'סכום כולל מע״מ', formValues.amount, !!ocrData.amount, true, '0.01')}
            {renderSmartInput('vatAmount', 'number', 'סכום מע״מ (₪)', 'אופציונלי', formValues.vatAmount, !!ocrData.vatAmount, false, '0.01')}
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            {renderSmartInput('date', 'date', 'תאריך ההוצאה', '', formValues.date, !!ocrData.date, true)}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                <span>מס' חשבונית / אסמכתא</span>
                {!!ocrData.invoiceNumber && <span title="זוהה אוטומטית ע״י AI" style={{ color: '#10b981', fontSize: '0.9rem' }}>✨ תואם למקור</span>}
              </label>
              <input name="invoiceNumber" defaultValue={ocrData.invoiceNumber || ''} placeholder="מספר מסמך (אופציונלי)" style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: !!ocrData.invoiceNumber ? '2px solid #10b981' : '1px solid var(--border-light)', background: !!ocrData.invoiceNumber ? '#ecfdf5' : 'rgba(0,0,0,0.02)', fontSize: '1rem', color: 'var(--text-primary)' }} />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                <span>ח.פ / עוסק מורשה</span>
                {!!ocrData.vatNumber && <span title="זוהה אוטומטית ע״י AI" style={{ color: '#10b981', fontSize: '0.9rem' }}>✨ תואם למקור</span>}
              </label>
              <input name="vatNumber" defaultValue={ocrData.vatNumber || ''} placeholder="מספר תאגיד (אופציונלי)" style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: !!ocrData.vatNumber ? '2px solid #10b981' : '1px solid var(--border-light)', background: !!ocrData.vatNumber ? '#ecfdf5' : 'rgba(0,0,0,0.02)', fontSize: '1rem', color: 'var(--text-primary)' }} />
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
            <button type="submit" disabled={!isFormValid && !isAnalyzing} style={{ width: '100%', background: (isFormValid || isAnalyzing) ? 'var(--primary)' : '#9ca3af', color: 'white', border: 'none', padding: '1rem', borderRadius: '12px', cursor: (isFormValid || isAnalyzing) ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '1rem', boxShadow: (isFormValid || isAnalyzing) ? '0 4px 12px rgba(79, 70, 229, 0.3)' : 'none', transition: 'all 0.2s ease' }}>
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

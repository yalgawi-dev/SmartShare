const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', 'utf8');

// Insert the state right after export function FinanceAddExpenseForm({ ... }) {
content = content.replace(
    /}: FinanceAddExpenseFormProps\) \{\n  return \(/,
    }: FinanceAddExpenseFormProps) {
  const [formValues, setFormValues] = React.useState({
    supplier: ocrData.vendor || '',
    amount: ocrData.amount || '',
    vatAmount: ocrData.vatAmount || '',
    date: ocrData.date || new Date().toISOString().split('T')[0]
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
  }, [JSON.stringify(ocrData)]);

  const handleChange = (e) => {
    setFormValues(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const isFormValid = formValues.supplier.trim() !== '' && formValues.amount.toString().trim() !== '' && formValues.date.trim() !== '';

  const renderSmartInput = (name, type, label, placeholder, value, aiExtracted, required = false, step = undefined) => {
    const isMissing = required && !value && scannedImage && !isAnalyzing;
    
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
        <label style={{ fontSize: '0.85rem', color: isMissing ? '#ef4444' : 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
          <span>{label} {required && '*'}</span>
          {aiExtracted && <span title="זוהה אוטומטית ע״י AI" style={{ color: '#10b981', fontSize: '0.9rem' }}>? תואם למקור</span>}
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
        {isMissing && <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.25rem' }}>?? ה-AI לא זיהה נתון זה, אנא הקלד ידנית</span>}
      </div>
    );
  };

  return (
);

// Replace the supplier section
content = content.replace(
    /<div style=\{\{ display: 'flex', flexDirection: 'column', gap: '0\.25rem' \}\}>\s*<label style=\{\{ fontSize: '0\.85rem', color: 'var\(--text-secondary\)', fontWeight: 'bold' \}\}>שם העסק \/ תיאור<\/label>\s*<div style=\{\{ display: 'flex', gap: '0\.5rem' \}\}>\s*<input required name="supplier" defaultValue=\{ocrData\.vendor \|\| ''\} placeholder="שם הספק \/ תיאור" style=\{.*?\} \/>\s*\{\!scannedImage && \(\s*<button type="button" onClick=\{.*?\} style=\{.*?\} title="סרוק חשבונית">\s*??\s*<\/button>\s*\)\}\s*<\/div>\s*<\/div>/,
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              {renderSmartInput('supplier', 'text', 'שם העסק / תיאור', 'שם הספק / תיאור', formValues.supplier, !!ocrData.vendor, true)}
              {!scannedImage && (
                <button type="button" onClick={() => setIsScanning(true)} style={{ background: 'var(--bg-main)', color: 'var(--text-primary)', border: '2px solid var(--border-light)', padding: '0 1rem', height: '52px', borderRadius: '12px', cursor: 'pointer', fontSize: '1.5rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="סרוק חשבונית">
                  ??
                </button>
              )}
            </div>
          </div>
);

// Replace the amount/date section
content = content.replace(
    /<div style=\{\{ display: 'flex', gap: '0\.5rem', width: '100%' \}\}>\s*<div style=\{\{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0\.25rem', minWidth: 0 \}\}>\s*<label style=\{\{ fontSize: '0\.85rem', color: 'var\(--text-secondary\)', fontWeight: 'bold' \}\}>סכום כולל מע״מ \(₪\)<\/label>\s*<input required name="amount" type="number" step="0\.01" defaultValue=\{ocrData\.amount \|\| ''\} placeholder="סכום כולל מע״מ" style=\{.*?\} \/>\s*<\/div>\s*<div style=\{\{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0\.25rem', minWidth: 0 \}\}>\s*<label style=\{\{ fontSize: '0\.85rem', color: 'var\(--text-secondary\)', fontWeight: 'bold' \}\}>תאריך<\/label>\s*<input required name="date" type="date" defaultValue=\{ocrData\.date \|\| new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]\} style=\{.*?\} \/>\s*<\/div>\s*<\/div>/,
    <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            {renderSmartInput('amount', 'number', 'סכום כולל מע״מ (₪)', 'סכום לתשלום', formValues.amount, !!ocrData.amount, true, '0.01')}
            {renderSmartInput('vatAmount', 'number', 'סכום מע״מ (₪)', 'אופציונלי', formValues.vatAmount, !!ocrData.vatAmount, false, '0.01')}
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            {renderSmartInput('date', 'date', 'תאריך ההוצאה', '', formValues.date, !!ocrData.date, true)}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                <span>מס' חשבונית / אסמכתא</span>
                {!!ocrData.invoiceNumber && <span title="זוהה אוטומטית ע״י AI" style={{ color: '#10b981', fontSize: '0.9rem' }}>? תואם למקור</span>}
              </label>
              <input name="invoiceNumber" defaultValue={ocrData.invoiceNumber || ''} placeholder="מספר מסמך" style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: !!ocrData.invoiceNumber ? '2px solid #10b981' : '1px solid var(--border-light)', background: !!ocrData.invoiceNumber ? '#ecfdf5' : 'rgba(0,0,0,0.02)', fontSize: '1rem', color: 'var(--text-primary)' }} />
            </div>
          </div>
);

// Replace invoice/vat section since I moved invoice to the date row
content = content.replace(
    /<div style=\{\{ display: 'flex', gap: '0\.5rem', width: '100%' \}\}>\s*<div style=\{\{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0\.25rem', minWidth: 0 \}\}>\s*<label style=\{\{ fontSize: '0\.85rem', color: 'var\(--text-secondary\)', fontWeight: 'bold' \}\}>מס' חשבונית \(אופציונלי\)<\/label>\s*<input name="invoiceNumber" defaultValue=\{ocrData\.invoiceNumber \|\| ''\} placeholder="מספר מסמך" style=\{.*?\} \/>\s*<\/div>\s*<div style=\{\{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0\.25rem', minWidth: 0 \}\}>\s*<label style=\{\{ fontSize: '0\.85rem', color: 'var\(--text-secondary\)', fontWeight: 'bold' \}\}>ח\.פ \/ ע\.מ \(אופציונלי\)<\/label>\s*<input name="vatNumber" defaultValue=\{ocrData\.vatNumber \|\| ''\} placeholder="מספר תאגיד" style=\{.*?\} \/>\s*<\/div>\s*<\/div>/,
    <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                <span>ח.פ / עוסק מורשה</span>
                {!!ocrData.vatNumber && <span title="זוהה אוטומטית ע״י AI" style={{ color: '#10b981', fontSize: '0.9rem' }}>? תואם למקור</span>}
              </label>
              <input name="vatNumber" defaultValue={ocrData.vatNumber || ''} placeholder="מספר תאגיד" style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: !!ocrData.vatNumber ? '2px solid #10b981' : '1px solid var(--border-light)', background: !!ocrData.vatNumber ? '#ecfdf5' : 'rgba(0,0,0,0.02)', fontSize: '1rem', color: 'var(--text-primary)' }} />
            </div>
          </div>
);

// Disable the submit button if invalid
content = content.replace(
    /<button type="submit" style=\{\{ width: '100%', background: 'var\(--primary\)', color: 'white', border: 'none', padding: '1rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 4px 12px rgba\(79, 70, 229, 0\.3\)' \}\}>/g,
    '<button type="submit" disabled={!isFormValid && !isAnalyzing} style={{ width: "100%", background: (isFormValid || isAnalyzing) ? "var(--primary)" : "#9ca3af", color: "white", border: "none", padding: "1rem", borderRadius: "12px", cursor: (isFormValid || isAnalyzing) ? "pointer" : "not-allowed", fontWeight: "bold", fontSize: "1rem", boxShadow: (isFormValid || isAnalyzing) ? "0 4px 12px rgba(79, 70, 229, 0.3)" : "none", transition: "all 0.2s ease" }}>'
);

fs.writeFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', content, 'utf8');

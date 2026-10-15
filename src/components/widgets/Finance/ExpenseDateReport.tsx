'use client';
import React, { useState, useMemo } from 'react';

interface ExpenseDateReportProps {
  invoices: any[];
  spaceTitle: string;
  onPreviewImage: (url: string) => void;
}

// Universal date normalizer: converts any DD.MM.YYYY, DD/MM/YYYY, or ISO string to standard YYYY-MM-DD
function normalizeToYMD(dateStr: any): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const trimmed = dateStr.trim();
  
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    if (parts.length === 3) {
      const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
      return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
      return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
      return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return '';
}

export function ExpenseDateReport({ invoices, spaceTitle, onPreviewImage }: ExpenseDateReportProps) {
  // Default to 'all' so all existing invoices appear right away!
  const [preset, setPreset] = useState<string>('all');
  
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isZipping, setIsZipping] = useState(false);
  const [showZipModal, setShowZipModal] = useState(false);
  const [zipFilename, setZipFilename] = useState('');
  const [zipConvertToPdf, setZipConvertToPdf] = useState(true);

  const handlePresetChange = (selectedPreset: string) => {
    setPreset(selectedPreset);
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();

    if (selectedPreset === 'current_month') {
      const start = new Date(y, m, 1).toISOString().split('T')[0];
      const end = today.toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(end);
    } else if (selectedPreset === 'last_month') {
      const start = new Date(y, m - 1, 1).toISOString().split('T')[0];
      const end = new Date(y, m, 0).toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(end);
    } else if (selectedPreset === 'last_3_months') {
      const start = new Date(y, m - 2, 1).toISOString().split('T')[0];
      const end = today.toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(end);
    } else if (selectedPreset === 'year_to_date') {
      const start = `${y}-01-01`;
      const end = today.toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(end);
    } else if (selectedPreset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (inv.isActive === false) return false;
      const invYMD = normalizeToYMD(inv.date || inv.createdAt);

      if (startDate && (!invYMD || invYMD < startDate)) return false;
      if (endDate && (!invYMD || invYMD > endDate)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const sup = (inv.supplier || '').toLowerCase();
        const cat = (inv.category || '').toLowerCase();
        const payer = (inv.payerName || '').toLowerCase();
        const notes = (inv.notes || '').toLowerCase();
        if (!sup.includes(q) && !cat.includes(q) && !payer.includes(q) && !notes.includes(q)) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      const dateA = normalizeToYMD(a.date || a.createdAt);
      const dateB = normalizeToYMD(b.date || b.createdAt);
      return dateB.localeCompare(dateA);
    });
  }, [invoices, startDate, endDate, searchQuery]);

  const totalAmount = useMemo(() => {
    return filteredInvoices.reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0);
  }, [filteredInvoices]);

  const invoicesCount = filteredInvoices.length;
  const avgAmount = invoicesCount > 0 ? Math.round(totalAmount / invoicesCount) : 0;
  const filesCount = filteredInvoices.filter(i => i.hasAttachment && i.attachmentUrl).length;

  const handleExportCSV = () => {
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = ['מזהה', 'תאריך', 'ספק', 'קטגוריה', 'משלם', 'סכום', 'מע"מ (%)', 'סטטוס', 'מסמך מצורף'];
    const rows = filteredInvoices.map(inv => [
      escapeCSV(inv.id),
      escapeCSV(inv.date),
      escapeCSV(inv.supplier || ''),
      escapeCSV(inv.category || ''),
      escapeCSV(inv.payerName || ''),
      escapeCSV(inv.amount || 0),
      escapeCSV(inv.vatRate || 0),
      escapeCSV(inv.status),
      escapeCSV(inv.hasAttachment ? 'כן' : 'לא')
    ]);

    const rangeTitle = startDate && endDate ? `${startDate}_to_${endDate}` : 'all';
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
      headers.join(',') + '\n' + 
      rows.map(e => e.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `דוח_הוצאות_${spaceTitle}_${rangeTitle}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportZIP = () => {
    const invoicesWithFiles = filteredInvoices.filter(inv => inv.hasAttachment && inv.attachmentUrl);
    if (invoicesWithFiles.length === 0) {
      alert('אין חשבוניות עם מסמכים מצורפים בטווח הנבחר.');
      return;
    }
    const rangeName = startDate && endDate ? `${startDate}_עד_${endDate}` : 'הכל';
    setZipFilename(`חשבוניות_${spaceTitle}_${rangeName}`);
    setShowZipModal(true);
  };

  const executeExportZIP = async () => {
    setShowZipModal(false);
    const invoicesWithFiles = filteredInvoices.filter(inv => inv.hasAttachment && inv.attachmentUrl);
    const userFilename = zipFilename || 'חשבוניות';
    const convertToPdf = zipConvertToPdf;
    setIsZipping(true);
    try {
      const JSZip = (await import('jszip')).default;
      const { saveAs } = await import('file-saver');
      const zip = new JSZip();
      const folder = zip.folder(userFilename);

      let count = 1;
      for (const inv of invoicesWithFiles) {
        try {
          const response = await fetch(inv.attachmentUrl!);
          let blob = await response.blob();
          
          let extension = 'jpg';
          if (blob.type === 'application/pdf' || inv.attachmentUrl?.includes('.pdf')) {
            extension = 'pdf';
          } else if (convertToPdf && (blob.type.includes('image') || inv.attachmentUrl?.match(/\.(jpg|jpeg|png)$/i))) {
             try {
                 const { jsPDF } = (await import('jspdf')).default ? await import('jspdf') : { jsPDF: (await import('jspdf')).jsPDF };
                 const Doc = jsPDF || (await import('jspdf')).default;
                 const img = new Image();
                 img.src = URL.createObjectURL(blob);
                 await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
                 
                 const orientation = img.width > img.height ? 'l' : 'p';
                 const pdf = new Doc({ orientation, unit: 'px', format: [img.width, img.height] });
                 pdf.addImage(img, 'JPEG', 0, 0, img.width, img.height);
                 blob = pdf.output('blob');
                 extension = 'pdf';
             } catch (err) {
                 console.error('Failed to convert image to PDF', err);
                 if (blob.type === 'image/png' || inv.attachmentUrl?.includes('.png')) extension = 'png';
             }
          } else if (blob.type === 'image/png' || inv.attachmentUrl?.includes('.png')) {
            extension = 'png';
          }
          
          const cleanSupplier = (inv.supplier || 'general').replace(/[/\\?%*:|"<>]/g, '-');
          const cleanAmount = inv.amount || '0';
          const cleanDate = inv.date || 'nodate';
          const filename = `${cleanDate}_${cleanSupplier}_${cleanAmount}₪_${count++}.${extension}`;
          
          folder?.file(filename, blob);
        } catch (e) {
          console.error('Failed to fetch attachment', inv.id, e);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${userFilename}.zip`);
    } catch (e) {
      console.error(e);
      alert('אירעה שגיאה ביצירת קובץ ה-ZIP.');
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card glass-panel" style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📅</span> סינון לפי תאריכים
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              מוצגות {invoicesCount} מתוך {invoices.filter(i => i.isActive !== false).length} חשבוניות
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'הכל (כל הזמנים)' },
              { id: 'current_month', label: 'החודש' },
              { id: 'last_month', label: 'חודש קודם' },
              { id: 'last_3_months', label: '3 חודשים' },
              { id: 'year_to_date', label: 'מתחילת השנה' },
              { id: 'custom', label: 'מותאם אישית' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id)}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '20px',
                  border: preset === p.id ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                  background: preset === p.id ? 'var(--primary)' : 'var(--bg-main)',
                  color: preset === p.id ? '#ffffff' : 'var(--text-primary)',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 'bold' }}>
              מתאריך:
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPreset('custom');
              }}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 'bold' }}>
              עד תאריך:
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPreset('custom');
              }}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 'bold' }}>
              חיפוש חופשי (ספק / קטגוריה / משלם):
            </label>
            <input
              type="text"
              placeholder="סינון מהיר..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem'
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="card glass-panel" style={{
          padding: '1.25rem 1.5rem',
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
          borderRadius: '16px',
          border: '2px solid var(--primary)',
          boxShadow: '0 4px 16px rgba(79, 70, 229, 0.1)'
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>💰 סך ההוצאות בטווח הנבחר</span>
          <div style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--primary)', marginTop: '0.35rem' }}>
            ₪{totalAmount.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {startDate || endDate ? `${startDate || 'תחילת הפרויקט'} ⟵ ${endDate || 'היום'}` : 'כל הזמנים'}
          </span>
        </div>

        <div className="card glass-panel" style={{ padding: '1.25rem 1.5rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>🧾 כמות חשבוניות</span>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '0.35rem' }}>
            {invoicesCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            מתוכן {filesCount} עם מסמך מצורף
          </span>
        </div>

        <div className="card glass-panel" style={{ padding: '1.25rem 1.5rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>📊 ממוצע להוצאה</span>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '0.35rem' }}>
            ₪{avgAmount.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            לפי {invoicesCount} רשומות
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'var(--bg-card)', padding: '1rem 1.25rem', borderRadius: '14px', border: '1px solid var(--border-light)' }}>
        <div>
          <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>ייצוא נתוני הטווח:</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '0.5rem' }}>
            ({invoicesCount} הוצאות בסך ₪{totalAmount.toLocaleString()})
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleExportCSV}
            disabled={invoicesCount === 0}
            style={{
              background: 'var(--bg-main)',
              color: 'var(--primary)',
              border: '1.5px solid var(--primary)',
              padding: '0.55rem 1.25rem',
              borderRadius: '10px',
              fontWeight: 'bold',
              cursor: invoicesCount === 0 ? 'not-allowed' : 'pointer',
              opacity: invoicesCount === 0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem'
            }}
          >
            <span>📊</span> ייצא טווח זה לאקסל
          </button>

          <button
            onClick={handleExportZIP}
            disabled={filesCount === 0 || isZipping}
            style={{
              background: 'var(--primary)',
              color: '#ffffff',
              border: 'none',
              padding: '0.55rem 1.25rem',
              borderRadius: '10px',
              fontWeight: 'bold',
              cursor: filesCount === 0 || isZipping ? 'not-allowed' : 'pointer',
              opacity: filesCount === 0 || isZipping ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem'
            }}
          >
            <span>{isZipping ? '⏳' : '📦'}</span> {isZipping ? 'מכין קובץ...' : `הורד מסמכים (${filesCount}) ZIP`}
          </button>
        </div>
      </div>

      <div className="card glass-panel" style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
            רשימת החשבוניות בטווח ({invoicesCount})
          </h3>
        </div>

        {filteredInvoices.length === 0 ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>📭</span>
            לא נמצאו חשבוניות בטווח התאריכים שנבחר.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>תאריך</th>
                  <th style={{ padding: '0.85rem 1rem' }}>ספק</th>
                  <th style={{ padding: '0.85rem 1rem' }}>קטגוריה</th>
                  <th style={{ padding: '0.85rem 1rem' }}>משלם</th>
                  <th style={{ padding: '0.85rem 1rem' }}>סכום</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>מסמך</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv, idx) => {
                  const ymd = normalizeToYMD(inv.date || inv.createdAt);
                  const displayDate = ymd ? ymd.split('-').reverse().join('.') : (inv.date || '---');
                  return (
                  <tr
                    key={inv.id || idx}
                    style={{
                      borderBottom: '1px solid var(--border-light)',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap', fontWeight: '500' }}>
                      {displayDate}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                      {inv.supplier || 'ספק כללי'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        background: 'rgba(99, 102, 241, 0.08)',
                        color: 'var(--primary)',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '12px',
                        fontSize: '0.78rem',
                        fontWeight: '600'
                      }}>
                        {inv.category || 'כללי'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                      {inv.payerName || '---'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 'bold', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      ₪{(Number(inv.amount) || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      {inv.hasAttachment && inv.attachmentUrl ? (
                        <button
                          onClick={() => onPreviewImage(inv.attachmentUrl)}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border-light)',
                            borderRadius: '8px',
                            padding: '0.3rem 0.6rem',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            color: 'var(--primary)',
                            fontWeight: '600'
                          }}
                          title="הצג מסמך"
                        >
                          <span>📄</span> צפה
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>-</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showZipModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card glass-panel" style={{ background: 'var(--bg-main)', padding: '2rem', borderRadius: '16px', maxWidth: '400px', width: '100%', border: '1px solid var(--border-light)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>ייצוא מסמכי הטווח (ZIP)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>שם קובץ ה-ZIP:</label>
                <input
                  type="text"
                  value={zipFilename}
                  onChange={e => setZipFilename(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>פורמט הקבצים:</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={() => setZipConvertToPdf(true)}
                    style={{
                      flex: 1, padding: '0.75rem', borderRadius: '8px',
                      border: zipConvertToPdf ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                      background: zipConvertToPdf ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)',
                      cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-primary)'
                    }}
                  >
                    📄 PDF
                  </button>
                  <button
                    onClick={() => setZipConvertToPdf(false)}
                    style={{
                      flex: 1, padding: '0.75rem', borderRadius: '8px',
                      border: !zipConvertToPdf ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                      background: !zipConvertToPdf ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)',
                      cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-primary)'
                    }}
                  >
                    🖼️ מקור
                  </button>
                </div>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {zipConvertToPdf ? 'כל החשבוניות יסודרו כקובצי PDF נקיים עבור רואה חשבון.' : 'החשבוניות יישמרו בפורמט המקורי שלהן (JPEG/PNG/PDF).'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button
                  onClick={() => setShowZipModal(false)}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ביטול
                </button>
                <button
                  onClick={executeExportZIP}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  הורד עכשיו 📦
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

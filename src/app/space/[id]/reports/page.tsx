"use client";
// @ts-nocheck

import { use, useState } from 'react';
import Link from 'next/link';
import { useSpaces } from '../../../context/SpacesContext';
import { useAuth } from '../../../context/AuthContext';
import { FinanceTransactions } from '../../../../components/widgets/Finance/FinanceTransactions';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import styles from '../page.module.css';

export default function SpaceReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { spaces } = useSpaces();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'pending_me' | 'pending_partners' | 'dispute' | 'archive'>('all');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilename, setExportFilename] = useState('');
  const [exportConvertToPdf, setExportConvertToPdf] = useState(true);
  
  const space = spaces.find(s => s.id === id);

  if (!space) {
    return <div className={styles.container}><h1>הפרויקט לא נמצא.</h1></div>;
  }

  const invoices = (space.invoices || []).filter(inv => inv.isActive !== false);
  const totalExpenses = invoices.reduce((acc, inv) => acc + (inv.amount || 0), 0);

  // Group by category for a simple analytics view
  const categoryTotals = invoices.reduce((acc: Record<string, number>, inv) => {
    const cat = inv.category || 'כללי';
    acc[cat] = (acc[cat] || 0) + (inv.amount || 0);
    return acc;
  }, {});

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
    const rows = invoices.map(inv => [
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

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
      headers.join(',') + '\n' + 
      rows.map(e => e.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `smartshare_report_${space.title}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportZIP = async () => {
    const invoicesWithFiles = invoices.filter(inv => inv.hasAttachment && inv.attachmentUrl);
    if (invoicesWithFiles.length === 0) {
      alert('אין חשבוניות עם מסמכים מצורפים להורדה.');
      return;
    }
    setExportFilename(space.title || 'MySpace');
    setShowExportModal(true);
  };

  const executeExportZIP = async () => {
    setShowExportModal(false);
    const invoicesWithFiles = invoices.filter(inv => inv.hasAttachment && inv.attachmentUrl);
    const userFilename = exportFilename || 'MySpace';
    const convertToPdf = exportConvertToPdf;
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
          
          // Replace illegal chars in filename
          const cleanSupplier = (inv.supplier || 'general').replace(/[/\\?%*:|"<>]/g, '-');
          const cleanAmount = inv.amount || '0';
          const filename = `receipt_${cleanSupplier}_${cleanAmount}_${count++}.${extension}`;
          
          folder?.file(filename, blob);
        } catch (e) {
          console.error('Failed to fetch attachment', inv.id, e);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${userFilename}.zip`);
    } catch (e) {
      console.error(e);
      alert('אירעה שגיאה ביצירת קובץ ה-ZIP. ייתכן שנדרשת הגדרת CORS בשרת.');
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className={styles.container} style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ position: 'sticky', top: 0, background: 'var(--bg-main, #f8fafc)', zIndex: 100, padding: '1rem 0', margin: '-1rem -1rem 1.5rem -1rem', paddingLeft: '1rem', paddingRight: '1rem', borderBottom: '1px solid var(--border-light)' }}>
        <Link href={`/space/${id}`} className={styles.backBtn} style={{ margin: 0 }}>
          <span>&rarr;</span> חזרה לקיר הפרויקט
        </Link>
      </div>

      <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <h1 className={styles.title}>📊 דוחות פיננסיים: {space.title}</h1>
          <p className={styles.subtitle}>ריכוז נתונים, פילוחים וייצוא להנהלת חשבונות</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button 
            onClick={handleExportCSV}
            style={{ background: 'white', color: 'var(--primary)', border: '1px solid var(--primary)', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, justifyContent: 'center' }}>
            <span>📄</span> ייצא לאקסל
          </button>
          <button 
            onClick={handleExportZIP}
            disabled={isZipping}
            style={{ opacity: isZipping ? 0.7 : 1,  background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, justifyContent: 'center' }}>
            {isZipping ? '⏳ מכין ZIP...' : '📦 הורד הכל (ZIP)'}
          </button>
        </div>
      </header>

      {/* Analytics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card glass-panel" style={{ padding: '1.5rem', background: 'var(--bg-card)', position: 'sticky', top: '75px', zIndex: 50, border: '2px solid var(--primary)', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>סך כל ההוצאות בפרויקט</h3>
          <h2 style={{ margin: 0, fontSize: '2.5rem', color: 'var(--text-primary)' }}>₪{totalExpenses.toLocaleString()}</h2>
        </div>
        
        <div className="card glass-panel" style={{ padding: '2rem', background: 'var(--bg-card)' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>פילוח לפי קטגוריות</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.entries(categoryTotals).map(([cat, total]) => (
              <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>{cat}</span>
                <span style={{ color: 'var(--text-secondary)' }}>₪{total.toLocaleString()}</span>
              </div>
            ))}
            {Object.keys(categoryTotals).length === 0 && (
              <div style={{ color: 'var(--text-secondary)' }}>אין נתונים זמינים.</div>
            )}
          </div>
        </div>
      </div>

      {/* Table Row via FinanceTransactions Component */}
      <div className="card glass-panel" style={{ background: 'var(--bg-card)' }}>
        <h3 style={{ margin: '0 0 1.5rem 0', padding: '1.5rem 1.5rem 0', color: 'var(--text-primary)' }}>טבלת הוצאות מפורטת</h3>
        
        <div style={{ padding: '0 1.5rem 1.5rem' }}>
          <FinanceTransactions 
            invoices={invoices}
            filteredInvoices={invoices}
            activePartnersCount={0}
            user={user}
            space={space}
            filter={filter}
            setFilter={setFilter}
            expandedInvoiceId={expandedInvoiceId}
            setExpandedInvoiceId={setExpandedInvoiceId}
            setPreviewImage={setPreviewImage}
          />
        </div>
      </div>

      {/* Full Screen Image Preview Modal */}
      {previewImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 999999, display: 'flex', flexDirection: 'column' }}>
          <button 
            type="button" 
            onClick={() => setPreviewImage(null)} 
            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(255, 255, 255, 0.2)', border: '2px solid white', color: 'white', width: '50px', height: '50px', borderRadius: '50%', fontSize: '1.5rem', cursor: 'pointer', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '3px' }}
            title="סגור תצוגה"
          >
            ✕
          </button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} onClick={() => setPreviewImage(null)}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', height: '100%' }}>
              <TransformWrapper initialScale={1} minScale={1} maxScale={5} centerOnInit={true}>
                <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
                  <img src={previewImage} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', margin: 'auto' }} />
                </TransformComponent>
              </TransformWrapper>
            </div>
          </div>
        </div>
      )}


      {/* Custom ZIP Export Modal */}
      {showExportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card glass-panel" style={{ background: 'var(--bg-main)', padding: '2rem', borderRadius: '16px', maxWidth: '400px', width: '100%', border: '1px solid var(--border-light)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>ייצוא קבצים (ZIP)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>שם קובץ ה-ZIP:</label>
                <input type="text" value={exportFilename} onChange={e => setExportFilename(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>פורמט הקבצים:</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={() => setExportConvertToPdf(true)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: exportConvertToPdf ? '2px solid var(--primary)' : '1px solid var(--border-light)', background: exportConvertToPdf ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-primary)' }}>📄 PDF</button>
                  <button onClick={() => setExportConvertToPdf(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: !exportConvertToPdf ? '2px solid var(--primary)' : '1px solid var(--border-light)', background: !exportConvertToPdf ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-primary)' }}>🖼️ מקור</button>
                </div>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {exportConvertToPdf ? 'כל החשבוניות יומרו ויסודרו כקובצי PDF נקיים (מומלץ לרואה חשבון).' : 'החשבוניות יישמרו בפורמט המקורי שלהן (קובצי JPEG או PDF).'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button onClick={() => setShowExportModal(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 'bold' }}>ביטול</button>
                <button onClick={executeExportZIP} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>הורד עכשיו 📦</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

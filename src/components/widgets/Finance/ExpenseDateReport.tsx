'use client';
import React, { useState, useMemo } from 'react';

interface ExpenseDateReportProps {
  invoices: any[];
  spaceTitle: string;
  onPreviewImage: (url: string) => void;
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

function formatYMD(year: number, month: number, day: number): string {
  const y = String(year);
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

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
    const y = parsed.getFullYear();
    const m = parsed.getMonth() + 1;
    const d = parsed.getDate();
    return formatYMD(y, m, d);
  }
  return '';
}

export function ExpenseDateReport({ invoices, spaceTitle, onPreviewImage }: ExpenseDateReportProps) {
  const [preset, setPreset] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // UI states
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [isZipping, setIsZipping] = useState(false);
  const [showZipModal, setShowZipModal] = useState(false);
  const [zipFilename, setZipFilename] = useState('');
  const [zipConvertToPdf, setZipConvertToPdf] = useState(true);

  const handlePresetChange = (selectedPreset: string) => {
    setPreset(selectedPreset);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1; // 1-12

    if (selectedPreset === 'current_month') {
      const start = formatYMD(y, m, 1);
      const end = formatYMD(y, m, getDaysInMonth(y, m));
      setStartDate(start);
      setEndDate(end);
    } else if (selectedPreset === 'last_month') {
      const prevY = m === 1 ? y - 1 : y;
      const prevM = m === 1 ? 12 : m - 1;
      const start = formatYMD(prevY, prevM, 1);
      const end = formatYMD(prevY, prevM, getDaysInMonth(prevY, prevM));
      setStartDate(start);
      setEndDate(end);
    } else if (selectedPreset === 'last_3_months') {
      let startM = m - 2;
      let startY = y;
      if (startM <= 0) {
        startM += 12;
        startY -= 1;
      }
      const start = formatYMD(startY, startM, 1);
      const end = formatYMD(y, m, getDaysInMonth(y, m));
      setStartDate(start);
      setEndDate(end);
    } else if (selectedPreset === 'year_to_date') {
      const start = formatYMD(y, 1, 1);
      const end = formatYMD(y, m, getDaysInMonth(y, m));
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

  // Group invoices by Year-Month
  const monthlyGroups = useMemo(() => {
    const groups: {
      key: string;
      year: number;
      month: number;
      monthName: string;
      invoices: any[];
      totalAmount: number;
      filesCount: number;
    }[] = [];

    const map = new Map<string, any[]>();
    filteredInvoices.forEach(inv => {
      const ymd = normalizeToYMD(inv.date || inv.createdAt);
      const key = ymd ? ymd.slice(0, 7) : 'ללא תאריך';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(inv);
    });

    const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

    sortedKeys.forEach(key => {
      const invs = map.get(key)!;
      const total = invs.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      const files = invs.filter(i => i.hasAttachment && i.attachmentUrl).length;
      
      let year = 0;
      let month = 0;
      let monthName = 'ללא תאריך';

      if (key !== 'ללא תאריך') {
        const [yStr, mStr] = key.split('-');
        year = parseInt(yStr, 10);
        month = parseInt(mStr, 10);
        monthName = `${HEBREW_MONTHS[month - 1] || mStr} ${year}`;
      }

      groups.push({
        key,
        year,
        month,
        monthName,
        invoices: invs,
        totalAmount: total,
        filesCount: files
      });
    });

    return groups;
  }, [filteredInvoices]);

  const totalAmount = useMemo(() => {
    return filteredInvoices.reduce((acc, inv) => acc + (Number(inv.amount) || 0), 0);
  }, [filteredInvoices]);

  const invoicesCount = filteredInvoices.length;
  const avgAmount = invoicesCount > 0 ? Math.round(totalAmount / invoicesCount) : 0;
  const filesCount = filteredInvoices.filter(i => i.hasAttachment && i.attachmentUrl).length;

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleExpandAll = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    monthlyGroups.forEach(g => {
      next[g.key] = expand;
    });
    setExpandedMonths(next);
  };

  const allExpanded = useMemo(() => {
    if (monthlyGroups.length === 0) return false;
    return monthlyGroups.every(g => expandedMonths[g.key]);
  }, [monthlyGroups, expandedMonths]);

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

  const currentPresetLabel = useMemo(() => {
    switch (preset) {
      case 'all': return 'כל הזמנים';
      case 'current_month': return 'החודש';
      case 'last_month': return 'חודש קודם';
      case 'last_3_months': return '3 חודשים';
      case 'year_to_date': return 'מתחילת השנה';
      case 'custom': return startDate && endDate ? `${startDate} - ${endDate}` : 'מותאם';
      default: return 'סינון';
    }
  }, [preset, startDate, endDate]);

  const monthsCountText = useMemo(() => {
    const c = monthlyGroups.length;
    if (c === 0) return 'אין נתונים';
    if (c === 1) return 'חודש אחד';
    if (c === 2) return 'שני חודשים';
    return `${c} חודשים`;
  }, [monthlyGroups.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '6rem' }}>
      
      {/* 1. TOP COMPACT KPI BANNER */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)',
        border: '1.5px solid var(--border-light)',
        borderRadius: '18px',
        padding: '1rem 1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
              סך ההוצאות בטווח ({currentPresetLabel})
            </span>
            {searchQuery && (
              <span style={{ fontSize: '0.75rem', background: 'rgba(99,102,241,0.15)', color: 'var(--primary)', padding: '0.1rem 0.45rem', borderRadius: '8px', fontWeight: 'bold' }}>
                "{searchQuery}"
              </span>
            )}
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--primary)', lineHeight: '1.2', marginTop: '0.2rem' }}>
            ₪{totalAmount.toLocaleString()}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>חשבוניות</span>
            <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)' }}>{invoicesCount}</span>
          </div>
          <div style={{ width: '1px', height: '24px', background: 'var(--border-light)' }} />
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>ממוצע</span>
            <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)' }}>₪{avgAmount.toLocaleString()}</span>
          </div>
          <div style={{ width: '1px', height: '24px', background: 'var(--border-light)' }} />
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>קבצים</span>
            <span style={{ fontSize: '1.15rem', fontWeight: '800', color: '#10b981' }}>{filesCount}</span>
          </div>
        </div>
      </div>

      {/* 2. TOOLBAR: EXPAND/COLLAPSE ALL & GROUP COUNT */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.25rem' }}>
        <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
          פירוט חודשי ({monthsCountText})
        </span>
        <button
          type="button"
          onClick={() => handleExpandAll(!allExpanded)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--primary)',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          <span>{allExpanded ? '▲ סגור הכל' : '▼ פתח הכל'}</span>
        </button>
      </div>

      {/* 3. MONTHLY ACCORDION CARDS */}
      {monthlyGroups.length === 0 ? (
        <div style={{ padding: '3rem 1rem', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '18px', border: '1px solid var(--border-light)' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>📭</span>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem' }}>לא נמצאו חשבוניות</h3>
          <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>נסה לשנות את טווח התאריכים או להסיר את מילת החיפוש.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {monthlyGroups.map((group) => {
            const isExpanded = !!expandedMonths[group.key];

            return (
              <div 
                key={group.key}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '16px',
                  border: isExpanded ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
                  boxShadow: isExpanded ? '0 4px 16px rgba(99, 102, 241, 0.08)' : 'var(--shadow-sm)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* MONTH HEADER ROW */}
                <div 
                  onClick={() => toggleMonth(group.key)}
                  dir="rtl"
                  style={{
                    padding: '0.875rem 1.15rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: isExpanded ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                    userSelect: 'none'
                  }}
                >
                  {/* Right side: Icon + Title + Count */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'right' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: isExpanded ? 'var(--primary)' : 'rgba(0,0,0,0.05)',
                      color: isExpanded ? 'white' : 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.1rem',
                      flexShrink: 0
                    }}>
                      📅
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                        {group.monthName}
                      </h4>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {group.invoices.length} חשבוניות {group.filesCount > 0 ? `• 📎 ${group.filesCount} קבלות` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Left side: Amount + Chevron */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', direction: 'ltr' }}>
                    <span style={{
                      fontSize: '0.85rem',
                      color: isExpanded ? 'var(--primary)' : 'var(--text-secondary)',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }}>
                      ▼
                    </span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                      ₪{group.totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* EXPANDED INVOICES LIST */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border-light)', background: 'var(--bg-main)' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.88rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '0.75rem 1rem' }}>תאריך</th>
                            <th style={{ padding: '0.75rem 1rem' }}>ספק</th>
                            <th style={{ padding: '0.75rem 1rem' }}>קטגוריה</th>
                            <th style={{ padding: '0.75rem 1rem' }}>משלם</th>
                            <th style={{ padding: '0.75rem 1rem' }}>סכום</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>מסמך</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.invoices.map((inv, idx) => {
                            const ymd = normalizeToYMD(inv.date || inv.createdAt);
                            const displayDate = ymd ? ymd.split('-').reverse().join('.') : (inv.date || '---');

                            return (
                              <tr 
                                key={inv.id || idx}
                                style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)' }}
                              >
                                <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', fontWeight: '500' }}>
                                  {displayDate}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                  {inv.supplier || 'ספק כללי'}
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
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
                                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                                  {inv.payerName || '---'}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                  ₪{(Number(inv.amount) || 0).toLocaleString()}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                  {inv.hasAttachment && inv.attachmentUrl ? (
                                    <button
                                      type="button"
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4. FLOATING BOTTOM ACTION BAR (RESPONSIVE & PADDED FOR MOBILE SAFE-AREA) */}
      <div style={{
        position: 'fixed',
        bottom: 'max(1.25rem, env(safe-area-inset-bottom, 1.25rem))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999,
        background: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(0, 0, 0, 0.12)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.16)',
        borderRadius: '30px',
        padding: '0.45rem 0.6rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem',
        width: 'calc(100% - 2rem)',
        maxWidth: '460px',
        boxSizing: 'border-box'
      }}>
        {/* FILTER BUTTON */}
        <button
          type="button"
          onClick={() => setShowFilterModal(true)}
          style={{
            flex: '1.2 1 0',
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            padding: '0.65rem 0.75rem',
            borderRadius: '20px',
            fontWeight: 'bold',
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          <span>🔍</span>
          <span>סינון ({currentPresetLabel})</span>
        </button>

        {/* EXPORT EXCEL */}
        <button
          type="button"
          onClick={handleExportCSV}
          disabled={invoicesCount === 0}
          style={{
            flex: '0.9 1 0',
            background: 'var(--bg-main, #f8fafc)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-light)',
            padding: '0.65rem 0.6rem',
            borderRadius: '20px',
            fontWeight: 'bold',
            fontSize: '0.85rem',
            cursor: invoicesCount === 0 ? 'not-allowed' : 'pointer',
            opacity: invoicesCount === 0 ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.3rem',
            whiteSpace: 'nowrap'
          }}
          title="ייצא נתונים לקובץ אקסל CSV"
        >
          <span>📊</span>
          <span>אקסל</span>
        </button>

        {/* EXPORT ZIP */}
        <button
          type="button"
          onClick={handleExportZIP}
          disabled={filesCount === 0 || isZipping}
          style={{
            flex: '1 1 0',
            background: '#10b981',
            color: 'white',
            border: 'none',
            padding: '0.65rem 0.6rem',
            borderRadius: '20px',
            fontWeight: 'bold',
            fontSize: '0.85rem',
            cursor: filesCount === 0 || isZipping ? 'not-allowed' : 'pointer',
            opacity: filesCount === 0 || isZipping ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.3rem',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            whiteSpace: 'nowrap'
          }}
          title="הורד את כל מסמכי הטווח כקובץ ZIP"
        >
          <span>{isZipping ? '⏳' : '📦'}</span>
          <span>ZIP ({filesCount})</span>
        </button>
      </div>

      {/* 5. FILTER BOTTOM SHEET MODAL */}
      {showFilterModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
          onClick={() => setShowFilterModal(false)}
        >
          <div 
            style={{
              background: 'var(--bg-card)',
              width: '100%',
              maxWidth: '560px',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              padding: '1.75rem',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>🔍 סינון ופילוח דוחות</h3>
              <button 
                type="button"
                onClick={() => setShowFilterModal(false)}
                style={{ background: 'var(--bg-hover)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* PRESET PILLS */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                בחירה מהירה לפי תקופה:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'הכל (כל הזמנים)' },
                  { id: 'current_month', label: 'החודש' },
                  { id: 'last_month', label: 'חודש קודם' },
                  { id: 'last_3_months', label: '3 חודשים' },
                  { id: 'year_to_date', label: 'מתחילת השנה' },
                  { id: 'custom', label: 'טווח חופשי' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePresetChange(p.id)}
                    style={{
                      padding: '0.5rem 0.9rem',
                      borderRadius: '20px',
                      border: preset === p.id ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                      background: preset === p.id ? 'var(--primary)' : 'var(--bg-main)',
                      color: preset === p.id ? '#ffffff' : 'var(--text-primary)',
                      fontWeight: 'bold',
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

            {/* DATE INPUTS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
                    padding: '0.75rem',
                    borderRadius: '12px',
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
                    padding: '0.75rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem'
                  }}
                />
              </div>
            </div>

            {/* FREE SEARCH */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 'bold' }}>
                חיפוש חופשי (ספק, קטגוריה, משלם):
              </label>
              <input
                type="text"
                placeholder="למשל: סופר פארם, משרד, יוסי..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem'
                }}
              />
            </div>

            {/* ACTION BUTTON */}
            <button
              type="button"
              onClick={() => setShowFilterModal(false)}
              style={{
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                padding: '0.95rem',
                borderRadius: '14px',
                fontWeight: 'bold',
                fontSize: '1.05rem',
                cursor: 'pointer',
                marginTop: '0.5rem',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
              }}
            >
              החל סינון ({invoicesCount} חשבוניות)
            </button>
          </div>
        </div>
      )}

      {/* 6. ZIP MODAL */}
      {showZipModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
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
                    type="button"
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
                    type="button"
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
                  type="button"
                  onClick={() => setShowZipModal(false)}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ביטול
                </button>
                <button
                  type="button"
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

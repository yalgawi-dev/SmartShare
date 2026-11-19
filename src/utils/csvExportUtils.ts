import { saveAs } from 'file-saver';
import { normalizeToYMD } from './dateUtils';
import { calculateExpenseVat } from './vatUtils';

/**
 * Universal, cross-platform CSV download utility.
 * Single Source of Truth for Excel / CSV exports.
 * 
 * Works seamlessly across:
 * - Desktop Chrome, Firefox, Edge, Safari
 * - Mobile Chrome & Samsung Internet (Android)
 * - Mobile Safari (iOS)
 * - PWA Standalone Mode (Android & iOS)
 */
export async function downloadCSV(filename: string, csvContent: string): Promise<boolean> {
  try {
    // 1. Ensure UTF-8 BOM so Excel opens Hebrew and Arabic correctly without garbled text
    const fullContent = csvContent.startsWith('\uFEFF') ? csvContent : '\uFEFF' + csvContent;
    const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;

    // 2. Create proper MIME type blob for Excel/CSV
    const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });

    // 3. First priority: file-saver saveAs (Handles browser-specific quirks, Android WebViews, iOS WebKit)
    if (typeof window !== 'undefined') {
      try {
        saveAs(blob, cleanFilename);
        return true;
      } catch (saveAsError) {
        console.warn('file-saver saveAs failed, trying fallback anchor:', saveAsError);
      }
    }

    // 4. Fallback anchor click with delayed URL revocation
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', cleanFilename);
    link.setAttribute('target', '_blank');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // CRITICAL: NEVER revoke immediately! Delay revocation by 60 seconds so browser download manager has time to complete
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }, 60000);

    return true;
  } catch (error) {
    console.error('downloadCSV fatal error:', error);
    return false;
  }
}

/**
 * Generates formatted CSV content for invoices conforming to user-specified order:
 * Columns: 1: ספק, 2: סכום, 3: משלם, 4: תאריך, 5: קטגוריה, 6: מסמך מצורף, 7: סטטוס
 * Followed by an empty line, prominent framed summary row with clean 'סה"כ כולל:' and numeric sum.
 */
export function generateInvoicesCSV(invoices: any[], spaceTitle: string, rangeTitle: string = 'all'): string {
  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Columns: ספק, סכום כולל, סכום לפני מע"מ, סכום מע"מ, סטטוס מע"מ, משלם, תאריך, קטגוריה, מסמך מצורף, סטטוס
  const headers = ['ספק', 'סכום כולל', 'סכום לפני מע"מ', 'סכום מע"מ', 'סטטוס מע"מ', 'משלם', 'תאריך', 'קטגוריה', 'מסמך מצורף', 'סטטוס'];

  const formatStatus = (status: string) => {
    if (status === 'approved') return 'מאושר';
    if (status === 'rejected') return 'נדחה';
    return 'ממתין לאישור';
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const ymd = normalizeToYMD(dateStr);
    if (ymd) return ymd.split('-').reverse().join('.');
    return dateStr;
  };

  let totalGross = 0;
  let totalNet = 0;
  let totalVat = 0;

  const rows = (invoices || []).map(inv => {
    const rawAmt = Number(inv.amount || 0);
    const vatCalc = calculateExpenseVat(rawAmt, Boolean(inv.isNoVat), inv.vatRate || 18);
    totalGross += vatCalc.totalAmount;
    totalNet += vatCalc.beforeVatAmount;
    totalVat += vatCalc.vatAmount;

    return [
      inv.supplier || '',
      vatCalc.totalAmount,
      vatCalc.beforeVatAmount,
      vatCalc.vatAmount,
      inv.isNoVat ? 'ללא מע״מ (פטור)' : `כולל מע״מ (${vatCalc.vatRate}%)`,
      inv.payerName || '',
      formatDate(inv.date),
      inv.category || 'כללי',
      inv.hasAttachment ? 'כן' : 'לא',
      formatStatus(inv.status)
    ];
  });

  totalGross = Number(totalGross.toFixed(2));
  totalNet = Number(totalNet.toFixed(2));
  totalVat = Number(totalVat.toFixed(2));

  // Empty separator row
  rows.push(['', '', '', '', '', '', '', '', '', '']);

  // Distinct visual framing line (simulating border / highlight in spreadsheets)
  const borderLine = ['════════════════', '════════════════', '════════════════', '════════════════', '════════════════', '════════════════', '════════════════', '════════════════', '════════════════', '════════════════'];
  rows.push(borderLine);

  // Prominent bold summary row:
  // - Column 1 (ספק): 'סה"כ כולל:'
  // - Column 2 (סכום כולל): totalGross
  // - Column 3 (סכום לפני מע"מ): totalNet
  // - Column 4 (סכום מע"מ): totalVat
  // - Column 5 (סטטוס מע"מ): 'סיכום מע"מ'
  // - Column 6 (משלם): Formatted currency display
  // - Column 7 (תאריך): Expense count
  rows.push([
    'סה"כ כולל:',
    totalGross,
    totalNet,
    totalVat,
    'סיכום מע"מ',
    `₪${totalGross.toLocaleString('he-IL')}`,
    `סה"כ הוצאות: ${invoices.length}`,
    '',
    '',
    ''
  ]);

  // Bottom framing line
  rows.push(borderLine);

  return '\uFEFF' + [headers, ...rows].map(r => r.map(c => escapeCSV(c)).join(',')).join('\n');
}

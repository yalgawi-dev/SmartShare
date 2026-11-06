import { saveAs } from 'file-saver';
import { normalizeToYMD } from './dateUtils';

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

  // 1: ספק, 2: סכום, 3: משלם, 4: תאריך, 5: קטגוריה, 6: מסמך מצורף, 7: סטטוס
  const headers = ['ספק', 'סכום', 'משלם', 'תאריך', 'קטגוריה', 'מסמך מצורף', 'סטטוס'];

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

  const rows = (invoices || []).map(inv => [
    inv.supplier || '',
    Number(inv.amount || 0),
    inv.payerName || '',
    formatDate(inv.date),
    inv.category || 'כללי',
    inv.hasAttachment ? 'כן' : 'לא',
    formatStatus(inv.status)
  ]);

  const totalAmount = (invoices || []).reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);

  // Empty separator row
  rows.push(['', '', '', '', '', '', '']);

  // Distinct visual framing line (simulating border / highlight in spreadsheets)
  const borderLine = ['════════════════', '════════════════', '════════════════', '════════════════', '════════════════', '════════════════', '════════════════'];
  rows.push(borderLine);

  // Prominent bold summary row:
  // - Column 1 (ספק): 'סה"כ כולל:' (Clean text without any garbled numbers or trailing 0)
  // - Column 2 (סכום): totalAmount (Numeric sum positioned directly under the 'סכום' column for calculations)
  // - Column 3 (משלם): Formatted currency display
  // - Column 4 (תאריך): Expense count
  rows.push([
    'סה"כ כולל:',
    totalAmount,
    `₪${totalAmount.toLocaleString('he-IL')}`,
    `סה"כ הוצאות: ${invoices.length}`,
    '',
    '',
    ''
  ]);

  // Bottom framing line
  rows.push(borderLine);

  return '\uFEFF' + [headers, ...rows].map(r => r.map(c => escapeCSV(c)).join(',')).join('\n');
}

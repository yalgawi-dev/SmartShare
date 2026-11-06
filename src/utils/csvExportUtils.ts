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
 * Generates formatted CSV content for invoices conforming to the flagship standard:
 * Columns: 1: ספק, 2: משלם, 3: תאריך, 4: סכום, 5: קטגוריה, 6: מסמך מצורף, 7: סטטוס
 * Followed by an empty line and a prominent total summary row.
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

  const headers = ['ספק', 'משלם', 'תאריך', 'סכום', 'קטגוריה', 'מסמך מצורף', 'סטטוס'];

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
    inv.payerName || '',
    formatDate(inv.date),
    Number(inv.amount || 0),
    inv.category || 'כללי',
    inv.hasAttachment ? 'כן' : 'לא',
    formatStatus(inv.status)
  ]);

  const totalAmount = (invoices || []).reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);

  // Empty separator row
  rows.push(['', '', '', '', '', '', '']);

  // Prominent bold summary row:
  // - Column 1 (ספק): Formatted total summary title and expense count
  // - Column 4 (סכום): Numeric sum totalAmount positioned directly under the 'סכום' column for Excel calculations
  rows.push([
    `סה"כ סכום כולל: ₪${totalAmount.toLocaleString('he-IL')} (${invoices.length} הוצאות)`,
    '',
    '',
    totalAmount,
    '',
    '',
    ''
  ]);

  return '\uFEFF' + [headers, ...rows].map(r => r.map(c => escapeCSV(c)).join(',')).join('\n');
}

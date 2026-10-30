/**
 * SmartShare Shared Date Utilities (Single Source of Truth - DRY)
 */

export const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

export function formatYMD(year: number, month: number, day: number): string {
  const y = String(year);
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function normalizeToYMD(dateStr: any): string {
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

export interface DateRangePresetResult {
  startDate: string;
  endDate: string;
  label: string;
}

export function getDateRangeForPreset(preset: string): DateRangePresetResult {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-12

  switch (preset) {
    case 'current_month': {
      const start = formatYMD(y, m, 1);
      const end = formatYMD(y, m, getDaysInMonth(y, m));
      return {
        startDate: start,
        endDate: end,
        label: `${HEBREW_MONTHS[m - 1]} ${y}`
      };
    }
    case 'last_month': {
      const prevY = m === 1 ? y - 1 : y;
      const prevM = m === 1 ? 12 : m - 1;
      const start = formatYMD(prevY, prevM, 1);
      const end = formatYMD(prevY, prevM, getDaysInMonth(prevY, prevM));
      return {
        startDate: start,
        endDate: end,
        label: `${HEBREW_MONTHS[prevM - 1]} ${prevY}`
      };
    }
    case 'last_3_months': {
      let startM = m - 2;
      let startY = y;
      if (startM <= 0) {
        startM += 12;
        startY -= 1;
      }
      const start = formatYMD(startY, startM, 1);
      const end = formatYMD(y, m, getDaysInMonth(y, m));
      return {
        startDate: start,
        endDate: end,
        label: `3 חודשים אחרונים`
      };
    }
    case 'year_to_date': {
      const start = formatYMD(y, 1, 1);
      const end = formatYMD(y, m, getDaysInMonth(y, m));
      return {
        startDate: start,
        endDate: end,
        label: `שנת ${y}`
      };
    }
    default:
      return {
        startDate: '',
        endDate: '',
        label: 'כל הזמנים'
      };
  }
}

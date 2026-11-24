/**
 * Single Source of Truth (DRY) for live thousands-separator formatting on numeric/currency inputs.
 * Preserves trailing decimal points and fractional zeros while typing (e.g. "12,500." or "12,500.50").
 */

export function stripAmountCommas(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).replace(/,/g, '').replace(/[^\d.]/g, '');
  const parts = str.split('.');
  if (parts.length <= 1) return str;
  // Keep only the first decimal point
  return `${parts[0]}.${parts.slice(1).join('')}`;
}

export function formatAmountInputDisplay(raw: string | number | null | undefined): string {
  const clean = stripAmountCommas(raw);
  if (!clean) return '';
  const hasDot = clean.includes('.');
  const [intPartRaw, decPartRaw = ''] = clean.split('.');
  const formattedInt = intPartRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return hasDot ? `${formattedInt}.${decPartRaw}` : formattedInt;
}

export function parseFormattedAmount(raw: string | number | null | undefined): number {
  const clean = stripAmountCommas(raw);
  if (!clean) return NaN;
  return Number(clean);
}

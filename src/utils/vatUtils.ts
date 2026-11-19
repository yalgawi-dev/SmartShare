/**
 * vatUtils.ts
 * Single Source of Truth (SSOT) for VAT extraction, calculations, and labeling.
 * Default standard Israel VAT rate is 18% (can be overridden via space settings).
 */

export const DEFAULT_VAT_RATE = 18;

export interface VatCalculationResult {
  /** Gross total amount (כולל מע"מ / סכום מלא) */
  totalAmount: number;
  /** Net amount before VAT (סכום ללא מע"מ) */
  beforeVatAmount: number;
  /** VAT amount (סכום המע"מ) */
  vatAmount: number;
  /** Effective VAT percentage applied (0 if exempt / noVat) */
  vatRate: number;
  /** Whether this expense is marked as exempt / no VAT */
  isNoVat: boolean;
}

/**
 * Calculates VAT components for an expense or invoice.
 * Formula for standard VAT:
 * beforeVat = total / (1 + rate / 100)
 * vat = total - beforeVat
 *
 * If isNoVat is true (or expense has noVat flag):
 * beforeVat = total
 * vat = 0
 * vatRate = 0
 */
export function calculateExpenseVat(
  amount: number | null | undefined,
  isNoVat: boolean | undefined,
  vatRate: number | undefined = DEFAULT_VAT_RATE
): VatCalculationResult {
  const total = Number(amount) || 0;
  const effectiveVatRate = typeof vatRate === 'number' && !isNaN(vatRate) && vatRate >= 0 ? vatRate : DEFAULT_VAT_RATE;

  if (isNoVat || total === 0 || effectiveVatRate === 0) {
    return {
      totalAmount: total,
      beforeVatAmount: total,
      vatAmount: 0,
      vatRate: 0,
      isNoVat: Boolean(isNoVat)
    };
  }

  // Standard calculation
  const beforeVat = Number((total / (1 + effectiveVatRate / 100)).toFixed(2));
  const vat = Number((total - beforeVat).toFixed(2));

  return {
    totalAmount: total,
    beforeVatAmount: beforeVat,
    vatAmount: vat,
    vatRate: effectiveVatRate,
    isNoVat: false
  };
}

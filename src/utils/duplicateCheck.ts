export const isDuplicateInvoice = (existingInv: any, incomingData: any) => {
  const invNum1 = existingInv.invoiceNumber ? String(existingInv.invoiceNumber).trim() : '';
  const invNum2 = incomingData.invoiceNumber ? String(incomingData.invoiceNumber).trim() : '';

  const vat1 = existingInv.vatNumber ? String(existingInv.vatNumber).trim() : '';
  const vat2 = incomingData.vatNumber ? String(incomingData.vatNumber).trim() : '';

  const amount1 = Number(existingInv.amount || 0);
  const amount2 = Number(incomingData.amount || 0);

  const vendor1 = existingInv.supplier || existingInv.vendor;
  const vendor2 = incomingData.vendor || incomingData.supplier;

  const date1 = existingInv.date || (existingInv.ocrData && existingInv.ocrData.date);
  const date2 = incomingData.date;

  const isVendorMatch = () => {
    if (!vendor1 || !vendor2) return false;
    const s1 = String(vendor1).trim().toLowerCase();
    const s2 = String(vendor2).trim().toLowerCase();
    if (s1 === s2 || s1.includes(s2) || s2.includes(s1)) return true;
    
    // Fuzzy word match: If any word longer than 2 chars matches
    const words1 = s1.split(/[\s,.-]+/).filter(w => w.length > 2);
    const words2 = s2.split(/[\s,.-]+/).filter(w => w.length > 2);
    for (const w1 of words1) {
      if (words2.includes(w1)) return true;
    }
    return false;
  };

  const amountsMatch = amount1 > 0 && amount1 === amount2;
  const datesMatch = Boolean(date1 && date2 && date1 === date2);
  const vatsMatch = Boolean(vat1 && vat2 && vat1 === vat2);

  // Tier 1: 100% Certainty
  if (invNum1 && invNum2 && invNum1 === invNum2 && vatsMatch) {
    return true;
  }

  // Tier 2: High Confidence (Soft Duplicate)
  // Invoice numbers match exactly, but VAT is missing or mismatched. We need corroboration!
  if (invNum1 && invNum2 && invNum1 === invNum2) {
    if (amountsMatch || datesMatch || isVendorMatch()) {
      return true;
    }
    // If only the invoice number matches, but NO corroborating evidence, ignore to avoid false positives.
    return false;
  }

  // Tier 3: Low Confidence (The Receipt Problem - No Invoice Number)
  if (!invNum1 || !invNum2) {
    if (amountsMatch && datesMatch && isVendorMatch()) {
      return true;
    }
  }

  return false;
};

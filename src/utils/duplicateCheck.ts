export const isDuplicateInvoice = (existingInv: any, incomingData: any) => {
  const invNum1 = existingInv.invoiceNumber ? String(existingInv.invoiceNumber).trim() : '';
  const invNum2 = incomingData.invoiceNumber ? String(incomingData.invoiceNumber).trim() : '';

  const amount1 = Number(existingInv.amount || 0);
  const amount2 = Number(incomingData.amount || 0);

  const vendor1 = existingInv.supplier || existingInv.vendor;
  const vendor2 = incomingData.vendor || incomingData.supplier;

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

  // Flow 1: Invoice Numbers match exactly (and are not empty)
  if (invNum1 && invNum2 && invNum1 === invNum2) {
    // If we have VAT numbers, they must match
    if (existingInv.vatNumber && incomingData.vatNumber && String(existingInv.vatNumber).trim() === String(incomingData.vatNumber).trim()) return true;
    
    // If amounts match, it's a duplicate
    if (amount1 > 0 && amount1 === amount2) return true;
    
    // If vendors match, it's a duplicate
    if (isVendorMatch()) return true;

    // If invoice numbers match perfectly but we have no other data to confirm/deny, it's highly likely a duplicate.
    return true;
  }

  // Flow 2: Missing or mismatching invoice numbers, but EXACT match on Amount, Date, and Vendor
  const date1 = existingInv.date || (existingInv.ocrData && existingInv.ocrData.date);
  const date2 = incomingData.date;
  
  if (amount1 > 0 && amount1 === amount2 && date1 && date2 && date1 === date2 && isVendorMatch()) {
    return true;
  }

  return false;
};

export const TREASURY_MEMBER_ID = 'virtual_treasury_member';

export function calculateCashboxBalance(invoices: any[]): number {
  if (!invoices || !Array.isArray(invoices)) return 0;
  
  let balance = 0;
  
  invoices.forEach(inv => {
    if (inv.isActive === false) return;
    
    // Deposits INTO the cashbox
    if (inv.type === 'transfer' && inv.status === 'approved' && inv.targetId === TREASURY_MEMBER_ID) {
      balance += (inv.amount || 0);
    }
    
    // Fallback/Special categories for deposits (Equity, Pay for Partner)
    if (inv.category === 'cashbox_equity' || inv.category === 'cashbox_partner' || inv.metadata?.isCashboxDeposit) {
      balance += (inv.amount || 0);
    }

    // Withdrawals FROM the cashbox (or cashbox paying for an expense)
    if (inv.payerId === TREASURY_MEMBER_ID || inv.payer === TREASURY_MEMBER_ID) {
      balance -= (inv.amount || 0);
    }
    
    // Explicit withdrawal category (Equity withdrawal)
    if (inv.category === 'cashbox_withdrawal') {
      balance -= (inv.amount || 0);
    }
  });
  
  return balance;
}

export const isCashboxEnabled = (space: any) => {
  return space?.features?.includes('cashbox') === true;
};

export const createVirtualTreasury = () => {
  return {
    id: TREASURY_MEMBER_ID,
    userId: TREASURY_MEMBER_ID,
    role: 'treasury',
    joinedAt: new Date().toISOString(),
    shares: 0,
    canEditShares: false,
    canInvitePartners: false
  };
};

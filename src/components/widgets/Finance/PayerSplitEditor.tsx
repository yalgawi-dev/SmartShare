'use client';

import React, { useState, useEffect, useMemo } from 'react';

export interface SplitPartnerOption {
  userId: string;
  name: string;
  defaultSharePct: number;
}

export type PayerSplitMode = 'single' | 'all_by_shares' | 'custom_split';

interface PayerSplitEditorProps {
  totalAmount: number;
  allPartners: SplitPartnerOption[];
  selectedPayerId: string;
  onSelectSinglePayer: (payerId: string) => void;
  splitMode: PayerSplitMode;
  onChangeSplitMode: (mode: PayerSplitMode) => void;
  payerSplits: Record<string, number>;
  onChangePayerSplits: (splits: Record<string, number>) => void;
  label?: string;
}

/**
 * Reusable Multi-Payer & Joint Account Split Engine (Rule DRY - Single Source of Truth)
 * Supports:
 * 1. Single Payer ('single')
 * 2. Paid by all partners together by their project share percentages / Joint Loan Account ('all_by_shares')
 * 3. Custom Split among selected partners ('custom_split') with seamless toggle between:
 *    - Exact Amount in ₪ (auto-computes percentage & auto-balances remaining partner)
 *    - Percentage % (auto-computes ₪ amount & auto-balances remaining partner)
 *    - Equal split among checked partners (1-click button)
 */
export const PayerSplitEditor: React.FC<PayerSplitEditorProps> = ({
  totalAmount,
  allPartners,
  selectedPayerId,
  onSelectSinglePayer,
  splitMode,
  onChangeSplitMode,
  payerSplits,
  onChangePayerSplits,
  label = 'מי שילם?'
}) => {
  // Input unit in custom mode: 'amount' (₪) or 'percent' (%)
  const [inputUnit, setInputUnit] = useState<'amount' | 'percent'>('amount');
  // Track which partners are checked in custom_split mode
  const [checkedPartnerIds, setCheckedPartnerIds] = useState<string[]>(() => {
    const existingKeys = Object.keys(payerSplits || {}).filter(k => (payerSplits[k] || 0) > 0);
    return existingKeys.length > 0 ? existingKeys : allPartners.map(p => p.userId);
  });

  const cleanTotal = useMemo(() => {
    const num = Number(totalAmount);
    return !isNaN(num) && num > 0 ? num : 0;
  }, [totalAmount]);

  // Helper: compute shares distribution across all partners
  const computeAllByShares = (amt: number): Record<string, number> => {
    const result: Record<string, number> = {};
    if (allPartners.length === 0) return result;
    const totalPct = allPartners.reduce((acc, p) => acc + (p.defaultSharePct || 0), 0) || 100;
    let runningSum = 0;
    allPartners.forEach((p, idx) => {
      if (idx === allPartners.length - 1) {
        result[p.userId] = Number(Math.max(0, amt - runningSum).toFixed(2));
      } else {
        const shareAmt = Number(((amt * (p.defaultSharePct || 0)) / totalPct).toFixed(2));
        result[p.userId] = shareAmt;
        runningSum += shareAmt;
      }
    });
    return result;
  };

  // Helper: compute equal distribution across checked partners
  const computeEqualAmongChecked = (amt: number, ids: string[]): Record<string, number> => {
    const result: Record<string, number> = {};
    if (ids.length === 0) return result;
    let runningSum = 0;
    ids.forEach((uid, idx) => {
      if (idx === ids.length - 1) {
        result[uid] = Number(Math.max(0, amt - runningSum).toFixed(2));
      } else {
        const shareAmt = Number((amt / ids.length).toFixed(2));
        result[uid] = shareAmt;
        runningSum += shareAmt;
      }
    });
    return result;
  };

  // Keep 'all_by_shares' synchronized whenever totalAmount changes
  useEffect(() => {
    if (splitMode === 'all_by_shares') {
      onChangePayerSplits(computeAllByShares(cleanTotal));
    }
  }, [splitMode, cleanTotal, allPartners.length]);

  const handleModeSwitch = (newMode: PayerSplitMode) => {
    onChangeSplitMode(newMode);
    if (newMode === 'single') {
      onChangePayerSplits({});
    } else if (newMode === 'all_by_shares') {
      onChangePayerSplits(computeAllByShares(cleanTotal));
    } else if (newMode === 'custom_split') {
      const activeIds = checkedPartnerIds.length > 0 ? checkedPartnerIds : allPartners.map(p => p.userId);
      setCheckedPartnerIds(activeIds);
      const currentSum = Object.values(payerSplits || {}).reduce((a, b) => a + (Number(b) || 0), 0);
      if (currentSum <= 0 || Math.abs(currentSum - cleanTotal) > 1) {
        onChangePayerSplits(computeAllByShares(cleanTotal));
      }
    }
  };

  const handleTogglePartnerCheck = (uid: string) => {
    const isChecked = checkedPartnerIds.includes(uid);
    let nextIds: string[];
    if (isChecked) {
      if (checkedPartnerIds.length <= 1) return; // Must keep at least 1 payer
      nextIds = checkedPartnerIds.filter(id => id !== uid);
    } else {
      nextIds = [...checkedPartnerIds, uid];
    }
    setCheckedPartnerIds(nextIds);
    // Redistribute equally among the newly checked partners
    onChangePayerSplits(computeEqualAmongChecked(cleanTotal, nextIds));
  };

  // Update a specific partner's amount (or percentage) and auto-balance the remaining partner if 2 are checked (or last checked partner)
  const handlePartnerValueChange = (uid: string, rawVal: string) => {
    const parsed = parseFloat(rawVal);
    const val = isNaN(parsed) ? 0 : Math.max(0, parsed);

    const newExactAmount = inputUnit === 'percent'
      ? Number(((cleanTotal * Math.min(100, val)) / 100).toFixed(2))
      : Number(val.toFixed(2));

    const nextSplits: Record<string, number> = {};
    checkedPartnerIds.forEach(id => {
      nextSplits[id] = Number(payerSplits[id] || 0);
    });
    nextSplits[uid] = newExactAmount;

    // Smart Auto-Complete: If 2 partners are checked, automatically fill the other partner with the remainder!
    // If >2 partners are checked, auto-adjust the last checked partner (if it's not the one being edited)
    const otherCheckedIds = checkedPartnerIds.filter(id => id !== uid);
    if (cleanTotal > 0 && otherCheckedIds.length === 1) {
      const otherId = otherCheckedIds[0];
      nextSplits[otherId] = Number(Math.max(0, cleanTotal - newExactAmount).toFixed(2));
    } else if (cleanTotal > 0 && otherCheckedIds.length > 1) {
      const lastOtherId = otherCheckedIds[otherCheckedIds.length - 1];
      const sumExceptLast = checkedPartnerIds
        .filter(id => id !== lastOtherId)
        .reduce((acc, id) => acc + (nextSplits[id] || 0), 0);
      if (sumExceptLast <= cleanTotal) {
        nextSplits[lastOtherId] = Number(Math.max(0, cleanTotal - sumExceptLast).toFixed(2));
      }
    }

    onChangePayerSplits(nextSplits);
  };

  const allocatedSum = useMemo(() => {
    return Object.entries(payerSplits || {}).reduce((acc, [uid, val]) => {
      if (splitMode === 'custom_split' && !checkedPartnerIds.includes(uid)) return acc;
      return acc + (Number(val) || 0);
    }, 0);
  }, [payerSplits, splitMode, checkedPartnerIds]);

  const diffFromTotal = Number((cleanTotal - allocatedSum).toFixed(2));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#f8fafc', padding: '0.85rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
      <label style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{label}</span>
        {splitMode !== 'single' && cleanTotal > 0 && (
          <span style={{ fontSize: '0.74rem', color: Math.abs(diffFromTotal) < 0.5 ? '#059669' : '#d97706', fontWeight: 700 }}>
            {Math.abs(diffFromTotal) < 0.5 ? '✓ מאוזן (100%)' : `הפרש להשלמה: ₪${diffFromTotal.toLocaleString()}`}
          </span>
        )}
      </label>

      {/* 3 Mode Pill Selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
        <button
          type="button"
          onClick={() => handleModeSwitch('single')}
          style={{
            padding: '0.5rem 0.35rem',
            borderRadius: '10px',
            border: splitMode === 'single' ? '2px solid #2563eb' : '1px solid #cbd5e1',
            background: splitMode === 'single' ? '#eff6ff' : '#ffffff',
            color: splitMode === 'single' ? '#1d4ed8' : '#475569',
            fontWeight: splitMode === 'single' ? 800 : 600,
            fontSize: '0.74rem',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            textAlign: 'center'
          }}
        >
          <span style={{ fontSize: '1rem' }}>👤</span>
          <span>משלם יחיד</span>
        </button>

        <button
          type="button"
          onClick={() => handleModeSwitch('all_by_shares')}
          style={{
            padding: '0.5rem 0.35rem',
            borderRadius: '10px',
            border: splitMode === 'all_by_shares' ? '2px solid #059669' : '1px solid #cbd5e1',
            background: splitMode === 'all_by_shares' ? '#ecfdf5' : '#ffffff',
            color: splitMode === 'all_by_shares' ? '#047857' : '#475569',
            fontWeight: splitMode === 'all_by_shares' ? 800 : 600,
            fontSize: '0.74rem',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            textAlign: 'center'
          }}
        >
          <span style={{ fontSize: '1rem' }}>🏦</span>
          <span>כולם / חשבון משותף</span>
        </button>

        <button
          type="button"
          onClick={() => handleModeSwitch('custom_split')}
          style={{
            padding: '0.5rem 0.35rem',
            borderRadius: '10px',
            border: splitMode === 'custom_split' ? '2px solid #7c3aed' : '1px solid #cbd5e1',
            background: splitMode === 'custom_split' ? '#f5f3ff' : '#ffffff',
            color: splitMode === 'custom_split' ? '#6d28d9' : '#475569',
            fontWeight: splitMode === 'custom_split' ? 800 : 600,
            fontSize: '0.74rem',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            textAlign: 'center'
          }}
        >
          <span style={{ fontSize: '1rem' }}>⚖️</span>
          <span>פיצול מותאם (₪ / %)</span>
        </button>
      </div>

      {/* MODE 1: SINGLE PAYER */}
      {splitMode === 'single' && (
        <select
          required
          value={selectedPayerId}
          onChange={e => onSelectSinglePayer(e.target.value)}
          style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', background: '#ffffff', color: '#0f172a', fontWeight: 600 }}
        >
          {allPartners.map(p => (
            <option key={p.userId} value={p.userId}>
              {p.name} ({Number(p.defaultSharePct.toFixed(1))}%)
            </option>
          ))}
        </select>
      )}

      {/* MODE 2: ALL PARTNERS TOGETHER / JOINT LOAN ACCOUNT */}
      {splitMode === 'all_by_shares' && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={{ fontSize: '0.78rem', color: '#065f46', fontWeight: 700, lineHeight: 1.35 }}>
            🏦 <strong>שולם ע"י כל השותפים יחד (חשבון משותף / הלוואה משותפת):</strong>
            <br />
            התשלום נרשם לזכות כל שותף בדיוק לפי אחוז האחזקה שלו, כך שאף שותף לא חייב לשני על הוצאה זו:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.2rem' }}>
            {allPartners.map(p => {
              const paidAmt = payerSplits[p.userId] ?? Number(((cleanTotal * p.defaultSharePct) / 100).toFixed(2));
              return (
                <div key={p.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', padding: '0.4rem 0.65rem', borderRadius: '8px', border: '1px solid #d1fae5', fontSize: '0.8rem' }}>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{p.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#059669', fontWeight: 800 }}>₪{paidAmt.toLocaleString('he-IL', { maximumFractionDigits: 2 })}</span>
                    <span style={{ background: '#d1fae5', color: '#047857', padding: '1px 6px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>
                      {Number(p.defaultSharePct.toFixed(1))}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE 3: CUSTOM SPLIT (BY EXACT AMOUNT ₪ OR PERCENTAGE %, PARTIAL OR ALL PARTNERS) */}
      {splitMode === 'custom_split' && (
        <div style={{ background: '#ffffff', border: '1px solid #ddd6fe', borderRadius: '12px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {/* Controls Header: Toggle ₪ vs % + Equal Split Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '2px', border: '1px solid #cbd5e1' }}>
              <button
                type="button"
                onClick={() => setInputUnit('amount')}
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: inputUnit === 'amount' ? '#7c3aed' : 'transparent',
                  color: inputUnit === 'amount' ? '#ffffff' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.74rem',
                  cursor: 'pointer'
                }}
              >
                ₪ לפי סכום כסף
              </button>
              <button
                type="button"
                onClick={() => setInputUnit('percent')}
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: inputUnit === 'percent' ? '#7c3aed' : 'transparent',
                  color: inputUnit === 'percent' ? '#ffffff' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.74rem',
                  cursor: 'pointer'
                }}
              >
                % לפי אחוזים
              </button>
            </div>

            <button
              type="button"
              onClick={() => onChangePayerSplits(computeEqualAmongChecked(cleanTotal, checkedPartnerIds))}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '8px',
                border: '1px solid #c4b5fd',
                background: '#f5f3ff',
                color: '#6d28d9',
                fontWeight: 700,
                fontSize: '0.72rem',
                cursor: 'pointer'
              }}
            >
              ⚖️ חלק שווה בשווה בין המסומנים ({checkedPartnerIds.length})
            </button>
          </div>

          {cleanTotal <= 0 && (
            <div style={{ fontSize: '0.75rem', color: '#d97706', background: '#fffbeb', padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid #fde68a' }}>
              💡 הזן קודם את סכום החשבונית למעלה כדי שהמערכת תחשב אוטומטית את הסכומים והאחוזים בין השותפים.
            </div>
          )}

          {/* Partner Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {allPartners.map(p => {
              const isChecked = checkedPartnerIds.includes(p.userId);
              const partnerAmt = isChecked ? Number(payerSplits[p.userId] || 0) : 0;
              const partnerPct = cleanTotal > 0 ? Number(((partnerAmt / cleanTotal) * 100).toFixed(1)) : 0;

              return (
                <div
                  key={p.userId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    padding: '0.45rem 0.6rem',
                    borderRadius: '10px',
                    background: isChecked ? '#f5f3ff' : '#f8fafc',
                    border: isChecked ? '1.5px solid #c4b5fd' : '1px solid #e2e8f0',
                    opacity: isChecked ? 1 : 0.6
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', minWidth: 0, flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleTogglePartnerCheck(p.userId)}
                      style={{ width: '17px', height: '17px', accentColor: '#7c3aed', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                        {inputUnit === 'amount'
                          ? `מהווה ${partnerPct}% מהחשבונית`
                          : `שילם בפועל: ₪${partnerAmt.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`}
                      </div>
                    </div>
                  </label>

                  {isChecked && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={inputUnit === 'amount' ? (partnerAmt || '') : (partnerPct || '')}
                        onChange={(e) => handlePartnerValueChange(p.userId, e.target.value)}
                        placeholder={inputUnit === 'amount' ? '0 ₪' : '0%'}
                        style={{
                          width: '92px',
                          padding: '0.35rem 0.5rem',
                          borderRadius: '8px',
                          border: '1px solid #a78bfa',
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          color: '#0f172a',
                          background: '#ffffff',
                          textAlign: 'left',
                          outline: 'none'
                        }}
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#6d28d9', width: '18px' }}>
                        {inputUnit === 'amount' ? '₪' : '%'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

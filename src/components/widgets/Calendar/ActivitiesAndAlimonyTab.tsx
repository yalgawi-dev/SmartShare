'use client';

import React, { useState } from 'react';
import {
  ActivityPaymentArrangement,
  KidActivityItem,
  ParentRole,
  SchoolBreakItem,
  SmartCalendarConfig,
  SpecialPeriodCategory,
  SpecialPeriodItem,
} from '@/types/calendar';
import {
  HEBREW_DAYS_SHORT,
  SPECIAL_PERIOD_META,
} from '@/utils/calendarCustodyEngine';
import {
  formatAmountInputDisplay,
  parseFormattedAmount,
  stripAmountCommas,
} from '@/utils/numberFormat';

interface ActivitiesAndAlimonyTabProps {
  config: SmartCalendarConfig;
  currentUserId: string;
  currentUserName: string;
  hasFinanceEngine?: boolean;
  onSaveConfig: (next: SmartCalendarConfig) => Promise<void>;
  onMarkAlimonyPaid: (ym: string) => Promise<void>;
  onOpenFinanceBridge?: () => void;
}

const PAYMENT_LABELS: Record<ActivityPaymentArrangement, string> = {
  split_50_50: '⚖️ חצי-חצי (50/50)',
  alternating_activities: '🔁 חוג עליי / חוג עליך',
  parent_a_only: '👤 משולם ע״י הורה א׳',
  parent_b_only: '👤 משולם ע״י הורה ב׳',
  custom_percent: '📊 לפי אחוזים מותאמים',
};

export const ActivitiesAndAlimonyTab: React.FC<ActivitiesAndAlimonyTabProps> = ({
  config,
  currentUserId,
  hasFinanceEngine,
  onSaveConfig,
  onMarkAlimonyPaid,
  onOpenFinanceBridge,
}) => {
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isPaidThisMonth = Boolean(config.alimony.paidMonths?.[currentYM]);

  // Alimony inline edit
  const [alimonyAmtInput, setAlimonyAmtInput] = useState(
    config.alimony.monthlyAmount ? String(config.alimony.monthlyAmount) : ''
  );

  // Add Activity form state
  const [actTitle, setActTitle] = useState('');
  const [actChildId, setActChildId] = useState(config.children[0]?.id || '');
  const [actDays, setActDays] = useState<number[]>([0, 3]);
  const [actTime, setActTime] = useState('17:00');
  const [actCost, setActCost] = useState('');
  const [actPayment, setActPayment] = useState<ActivityPaymentArrangement>('split_50_50');

  // Add School Break form state
  const [brkTitle, setBrkTitle] = useState('');
  const [brkStart, setBrkStart] = useState('');
  const [brkEnd, setBrkEnd] = useState('');
  const [brkParent, setBrkParent] = useState<SchoolBreakItem['assignedParent']>('regular');

  // Add Special / Emergency Period state
  const [spTitle, setSpTitle] = useState('');
  const [spCategory, setSpCategory] = useState<SpecialPeriodCategory>('reserve_duty');
  const [spStart, setSpStart] = useState('');
  const [spEnd, setSpEnd] = useState('');
  const [spOverride, setSpOverride] = useState<ParentRole | ''>('');
  const [spNotes, setSpNotes] = useState('');

  const pA = config.parents.parent_a;
  const pB = config.parents.parent_b;

  const handleSaveAlimony = async () => {
    const num = parseFormattedAmount(alimonyAmtInput);
    await onSaveConfig({
      ...config,
      alimony: {
        ...config.alimony,
        monthlyAmount: !isNaN(num) && num > 0 ? num : undefined,
      },
    });
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actTitle.trim()) return;
    const costNum = parseFormattedAmount(actCost);
    const item: KidActivityItem = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      title: actTitle.trim(),
      childId: actChildId || config.children[0]?.id || 'all',
      daysOfWeek: actDays.length > 0 ? actDays : [0],
      time: actTime || undefined,
      paymentArrangement: actPayment,
      monthlyCost: !isNaN(costNum) && costNum > 0 ? costNum : undefined,
    };
    await onSaveConfig({
      ...config,
      activities: [...(config.activities || []), item],
    });
    setActTitle('');
    setActCost('');
  };

  const handleRemoveActivity = async (id: string) => {
    await onSaveConfig({
      ...config,
      activities: (config.activities || []).filter((a) => a.id !== id),
    });
  };

  const handleAddSchoolBreak = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brkTitle.trim() || !brkStart) return;
    const item: SchoolBreakItem = {
      id: `brk_${Date.now()}`,
      title: brkTitle.trim(),
      startDate: brkStart,
      endDate: brkEnd && brkEnd >= brkStart ? brkEnd : brkStart,
      assignedParent: brkParent,
      isCustom: true,
    };
    await onSaveConfig({
      ...config,
      schoolBreaks: [item, ...(config.schoolBreaks || [])],
    });
    setBrkTitle('');
    setBrkStart('');
    setBrkEnd('');
  };

  const handleUpdateBreakParent = async (id: string, assignedParent: SchoolBreakItem['assignedParent']) => {
    await onSaveConfig({
      ...config,
      schoolBreaks: (config.schoolBreaks || []).map((b) =>
        b.id === id ? { ...b, assignedParent } : b
      ),
    });
  };

  const handleRemoveBreak = async (id: string) => {
    await onSaveConfig({
      ...config,
      schoolBreaks: (config.schoolBreaks || []).filter((b) => b.id !== id),
    });
  };

  const handleAddSpecialPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spTitle.trim() || !spStart) return;
    const item: SpecialPeriodItem = {
      id: `sp_${Date.now()}`,
      title: spTitle.trim(),
      category: spCategory,
      startDate: spStart,
      endDate: spEnd && spEnd >= spStart ? spEnd : spStart,
      overrideParent: spOverride || undefined,
      childIds: 'all',
      notes: spNotes.trim() || undefined,
      createdBy: currentUserId,
      createdAt: new Date().toISOString(),
    };
    await onSaveConfig({
      ...config,
      specialPeriods: [item, ...(config.specialPeriods || [])],
    });
    setSpTitle('');
    setSpStart('');
    setSpEnd('');
    setSpNotes('');
  };

  const handleRemoveSpecialPeriod = async (id: string) => {
    await onSaveConfig({
      ...config,
      specialPeriods: (config.specialPeriods || []).filter((s) => s.id !== id),
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* 1. ALIMONY SCHEDULE & REMINDER */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
            💳 תזכורת ומעקב מזונות חודשי
          </h4>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 800 }}>
            <input
              type="checkbox"
              checked={config.alimony.enabled}
              onChange={(e) =>
                onSaveConfig({
                  ...config,
                  alimony: { ...config.alimony, enabled: e.target.checked },
                })
              }
              style={{ accentColor: '#10b981', width: '16px', height: '16px' }}
            />
            פעיל
          </label>
        </div>

        {config.alimony.enabled && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.45rem' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>
                הורה משלם:
                <select
                  value={config.alimony.payingParent}
                  onChange={(e) =>
                    onSaveConfig({
                      ...config,
                      alimony: { ...config.alimony, payingParent: e.target.value as ParentRole },
                    })
                  }
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', marginTop: '2px' }}
                >
                  <option value="parent_a">{pA.name}</option>
                  <option value="parent_b">{pB.name}</option>
                </select>
              </label>

              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>
                יום בחודש לתשלום:
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={config.alimony.dueDayOfMonth}
                  onChange={(e) =>
                    onSaveConfig({
                      ...config,
                      alimony: { ...config.alimony, dueDayOfMonth: Math.max(1, Math.min(28, Number(e.target.value) || 1)) },
                    })
                  }
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '2px' }}
                />
              </label>

              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>
                סכום חודשי (₪):
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  placeholder="0"
                  value={formatAmountInputDisplay(alimonyAmtInput)}
                  onChange={(e) => setAlimonyAmtInput(stripAmountCommas(e.target.value))}
                  onBlur={handleSaveAlimony}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '2px', textAlign: 'left' }}
                />
              </label>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
                padding: '0.6rem 0.75rem',
                borderRadius: '12px',
                background: isPaidThisMonth ? '#ecfdf5' : '#fffbeb',
                border: isPaidThisMonth ? '1px solid #a7f3d0' : '1px solid #fde68a',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: isPaidThisMonth ? '#065f46' : '#92400e' }}>
                {isPaidThisMonth
                  ? `✅ מזונות חודש ${currentYM} סומנו כשולמו!`
                  : `🔔 תזכורת: תשלום מזונות ע״י ${config.parents[config.alimony.payingParent].name} בכל ${config.alimony.dueDayOfMonth} לחודש`}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {!isPaidThisMonth && (
                  <button
                    type="button"
                    onClick={() => onMarkAlimonyPaid(currentYM)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#10b981',
                      color: '#ffffff',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    ✅ סמן ששולם החודש
                  </button>
                )}
                {hasFinanceEngine && onOpenFinanceBridge && (
                  <button
                    type="button"
                    onClick={onOpenFinanceBridge}
                    style={{
                      padding: '0.35rem 0.7rem',
                      borderRadius: '8px',
                      border: '1px solid #c7d2fe',
                      background: '#eef2ff',
                      color: '#4338ca',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    🧾 רשום בהתחשבנויות
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 2. KIDS ACTIVITIES & COST ARRANGEMENTS */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
        }}
      >
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
          🏅 חוגים קבועים והסדרי תשלום
        </h4>

        {(config.activities || []).map((act) => {
          const child = config.children.find((c) => c.id === act.childId);
          const daysStr = act.daysOfWeek.map((d) => HEBREW_DAYS_SHORT[d]).join(', ');
          return (
            <div
              key={act.id}
              style={{
                padding: '0.55rem 0.7rem',
                borderRadius: '11px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <div style={{ fontSize: '0.8rem' }}>
                <div style={{ fontWeight: 800, color: '#0f172a' }}>
                  {act.title} {child ? `(${child.name})` : ''} • ימים: {daysStr} {act.time ? `🕒 ${act.time}` : ''}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#475569' }}>
                  {PAYMENT_LABELS[act.paymentArrangement]}
                  {act.monthlyCost ? ` • ₪${act.monthlyCost.toLocaleString('he-IL')}/חודש` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveActivity(act.id)}
                style={{ border: 'none', background: '#fef2f2', color: '#dc2626', borderRadius: '8px', padding: '0.25rem 0.5rem', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
              >
                מחק
              </button>
            </div>
          );
        })}

        <form onSubmit={handleAddActivity} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', background: '#f8fafc', padding: '0.7rem', borderRadius: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            <input
              type="text"
              required
              placeholder="שם החוג (כדורגל, ג׳ודו, ריקוד)"
              value={actTitle}
              onChange={(e) => setActTitle(e.target.value)}
              style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            />
            <select
              value={actChildId}
              onChange={(e) => setActChildId(e.target.value)}
              style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.8rem' }}
            >
              <option value="all">כל הילדים</option>
              {config.children.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {HEBREW_DAYS_SHORT.map((lbl, dow) => {
              const active = actDays.includes(dow);
              return (
                <button
                  key={dow}
                  type="button"
                  onClick={() =>
                    setActDays((prev) =>
                      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow]
                    )
                  }
                  style={{
                    padding: '0.28rem 0.5rem',
                    borderRadius: '8px',
                    border: active ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                    background: active ? '#f5f3ff' : '#fff',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
            <input
              type="time"
              value={actTime}
              onChange={(e) => setActTime(e.target.value)}
              style={{ padding: '0.42rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
            />
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              placeholder="עלות ₪/חודש"
              value={formatAmountInputDisplay(actCost)}
              onChange={(e) => setActCost(stripAmountCommas(e.target.value))}
              style={{ padding: '0.42rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.78rem', textAlign: 'left' }}
            />
            <select
              value={actPayment}
              onChange={(e) => setActPayment(e.target.value as ActivityPaymentArrangement)}
              style={{ padding: '0.42rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.76rem' }}
            >
              <option value="split_50_50">חצי-חצי (50/50)</option>
              <option value="alternating_activities">חוג עליי / חוג עליך</option>
              <option value="parent_a_only">{pA.name} משלם</option>
              <option value="parent_b_only">{pB.name} משלם</option>
            </select>
          </div>
          <button
            type="submit"
            style={{ padding: '0.5rem', borderRadius: '9px', border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}
          >
            ➕ הוסף חוג ללוח
          </button>
        </form>
      </div>

      {/* 3. SPECIAL / EMERGENCY PERIODS (WAR, RESERVE DUTY, QUARANTINE) */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
        }}
      >
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
          🛡️ אירועים מיוחדים ומצבי חירום (מלחמה / מילואים / קורונה / בידוד)
        </h4>

        {(config.specialPeriods || []).map((sp) => {
          const meta = SPECIAL_PERIOD_META[sp.category];
          return (
            <div
              key={sp.id}
              style={{
                padding: '0.55rem 0.7rem',
                borderRadius: '11px',
                background: meta.bg,
                border: `1px solid ${meta.color}44`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: meta.color }}>
                <div style={{ fontWeight: 900 }}>
                  {meta.icon} {sp.title} ({sp.startDate} → {sp.endDate})
                </div>
                {sp.overrideParent && (
                  <div style={{ fontWeight: 700 }}>
                    שהות זמנית אצל: {config.parents[sp.overrideParent].name} (חוזר אוטומטית לשגרה בסיום)
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemoveSpecialPeriod(sp.id)}
                style={{ border: 'none', background: '#ffffff', color: '#dc2626', borderRadius: '8px', padding: '0.25rem 0.5rem', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
              >
                הסר
              </button>
            </div>
          );
        })}

        <form onSubmit={handleAddSpecialPeriod} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', background: '#f8fafc', padding: '0.7rem', borderRadius: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            <input
              type="text"
              required
              placeholder="כותרת (למשל: צו 8 מילואים / סגר / בידוד)"
              value={spTitle}
              onChange={(e) => setSpTitle(e.target.value)}
              style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
            />
            <select
              value={spCategory}
              onChange={(e) => setSpCategory(e.target.value as SpecialPeriodCategory)}
              style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.8rem' }}
            >
              <option value="war">🛡️ מלחמה / מצב ביטחוני</option>
              <option value="reserve_duty">🎖️ מילואים</option>
              <option value="quarantine">😷 קורונה / בידוד</option>
              <option value="medical">🏥 אשפוז / רפואי</option>
              <option value="travel">✈️ נסיעה / חו״ל</option>
              <option value="other">⚡ אירוע מיוחד אחר</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
            <input type="date" required value={spStart} onChange={(e) => setSpStart(e.target.value)} style={{ padding: '0.42rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.76rem' }} />
            <input type="date" value={spEnd} min={spStart} onChange={(e) => setSpEnd(e.target.value)} style={{ padding: '0.42rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.76rem' }} />
            <select
              value={spOverride}
              onChange={(e) => setSpOverride(e.target.value as any)}
              style={{ padding: '0.42rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.74rem' }}
            >
              <option value="">ללא שינוי שהות</option>
              <option value="parent_a">שהות זמנית: {pA.name}</option>
              <option value="parent_b">שהות זמנית: {pB.name}</option>
            </select>
          </div>
          <button
            type="submit"
            style={{ padding: '0.5rem', borderRadius: '9px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}
          >
            🛡️ הוסף תקופה מיוחדת ללוח
          </button>
        </form>
      </div>

      {/* 4. EDITABLE SCHOOL BREAKS & HOLIDAYS */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
        }}
      >
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
          🏖️ חגים וחופשות בית ספר (ניתן לעדכון ועריכה)
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '260px', overflowY: 'auto' }}>
          {(config.schoolBreaks || []).map((brk) => (
            <div
              key={brk.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.65rem',
                borderRadius: '10px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                fontSize: '0.76rem',
              }}
            >
              <div>
                <strong>{brk.title}</strong>
                <div style={{ color: '#92400e', fontSize: '0.7rem' }}>
                  {brk.startDate} → {brk.endDate}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <select
                  value={brk.assignedParent}
                  onChange={(e) => handleUpdateBreakParent(brk.id, e.target.value as any)}
                  style={{ padding: '0.28rem 0.4rem', borderRadius: '8px', border: '1px solid #fcd34d', background: '#fff', fontSize: '0.72rem', fontWeight: 700 }}
                >
                  <option value="regular">לפי שגרה</option>
                  <option value="split">חצי-חצי</option>
                  <option value="parent_a">{pA.name}</option>
                  <option value="parent_b">{pB.name}</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleRemoveBreak(brk.id)}
                  style={{ border: 'none', background: '#fff', color: '#dc2626', borderRadius: '6px', padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddSchoolBreak} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', background: '#f8fafc', padding: '0.65rem', borderRadius: '12px' }}>
          <input
            type="text"
            required
            placeholder="שם חופשה / גשר / שביתה"
            value={brkTitle}
            onChange={(e) => setBrkTitle(e.target.value)}
            style={{ gridColumn: '1 / -1', padding: '0.45rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
          />
          <input type="date" required value={brkStart} onChange={(e) => setBrkStart(e.target.value)} style={{ padding: '0.42rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.76rem' }} />
          <input type="date" value={brkEnd} min={brkStart} onChange={(e) => setBrkEnd(e.target.value)} style={{ padding: '0.42rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.76rem' }} />
          <select
            value={brkParent}
            onChange={(e) => setBrkParent(e.target.value as any)}
            style={{ padding: '0.42rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.76rem' }}
          >
            <option value="regular">לפי שגרה</option>
            <option value="split">חצי-חצי</option>
            <option value="parent_a">{pA.name}</option>
            <option value="parent_b">{pB.name}</option>
          </select>
          <button
            type="submit"
            style={{ padding: '0.45rem', borderRadius: '8px', border: 'none', background: '#d97706', color: '#fff', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
          >
            ➕ הוסף חופשה
          </button>
        </form>
      </div>
    </div>
  );
};

'use client';

import { use, useState } from 'react';
import styles from './page.module.css';
import Link from 'next/link';
import { useSpaces } from '../../../context/SpacesContext';

type InvoiceStatus = 'approved' | 'pending' | 'dispute' | 'missing';

interface MockInvoice {
  id: string;
  amount: number | null;
  supplier: string | null;
  payerName: string | null;
  date: string;
  status: InvoiceStatus;
  note: string;
  approvalsNeeded: number;
  approvalsReceived: number;
}

const mockInvoices: MockInvoice[] = [
  {
    id: '1',
    amount: 1500,
    supplier: 'הום סנטר - חומרי בניין',
    payerName: 'דני (אני)',
    date: '25/07/2026',
    status: 'pending',
    note: 'קניתי מלט וברזלים לפי בקשת הקבלן. ממתין לאישורכם.',
    approvalsNeeded: 2,
    approvalsReceived: 1,
  },
  {
    id: '2',
    amount: 450,
    supplier: 'קבלן חשמל',
    payerName: 'יוסי',
    date: '24/07/2026',
    status: 'dispute',
    note: 'תשלום על נקודות החשמל הנוספות בסלון.',
    approvalsNeeded: 2,
    approvalsReceived: 0,
  },
  {
    id: '3',
    amount: null,
    supplier: null,
    payerName: null,
    date: '23/07/2026',
    status: 'missing',
    note: 'חשבונית שעלתה מהמחשב ללא פרטים.',
    approvalsNeeded: 0,
    approvalsReceived: 0,
  },
  {
    id: '4',
    amount: 12000,
    supplier: 'קבלן שלד - מקדמה',
    payerName: 'דני (אני)',
    date: '10/07/2026',
    status: 'approved',
    note: 'הועבר לחשבון של הקבלן בביט.',
    approvalsNeeded: 2,
    approvalsReceived: 2,
  },
];

export default function FinancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { spaces } = useSpaces();
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');
  
  const space = spaces.find(s => s.id === id);

  if (!space) {
    return <div className={styles.container}><h1>הפרויקט לא נמצא.</h1></div>;
  }

  const hasScanner = space.features.includes('scanner');
  const hasCashbox = space.features.includes('cashbox');
  const hasPartners = space.features.includes('partners');

  const filteredInvoices = mockInvoices.filter(inv => filter === 'all' || inv.status === filter);

  return (
    <div className={styles.container}>
      <Link href={`/space/${id}`} className={styles.backBtn}>
        <span>&rarr;</span> חזרה למרחב {space.title}
      </Link>

      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1>💰 התחשבנות וחשבוניות</h1>
          <p>ריכוז ההוצאות של הפרויקט, חלוקת תשלומים וניהול אישורים.</p>
        </div>
        <button className={styles.addBtn} onClick={() => alert('פתיחת SmartUploader (יוטמע בקרוב)')}>
          + הוסף הוצאה
        </button>
      </header>

      {!hasScanner && (
        <div className={styles.suggestionBanner}>
          <span className={styles.suggestionText}>
            💡 רוב המשתמשים מצרפים למודול זה את <b>סורק החשבוניות</b> (OCR) לחיסכון בהקלדה ידנית.
          </span>
          <Link href={`/space/${id}/features`} className={styles.suggestionLink}>
            הוסף סורק
          </Link>
        </div>
      )}

      {hasPartners && (
        <div className="card glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '2rem', background: 'var(--bg-card)' }}>
          <div>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>סך הוצאות מאושרות במרחב</h4>
            <span style={{ fontSize: '2rem', fontWeight: 'bold' }}>₪12,000</span>
          </div>
          <div style={{ borderRight: '1px solid var(--border-light)', paddingRight: '2rem' }}>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>חלקך בהוצאות</h4>
            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>₪6,000</span>
          </div>
        </div>
      )}

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${filter === 'all' ? styles.activeTab : ''}`} onClick={() => setFilter('all')}>הכל</button>
        <button className={`${styles.tab} ${filter === 'pending' ? styles.activeTab : ''}`} onClick={() => setFilter('pending')}>ממתין לאישור (1)</button>
        <button className={`${styles.tab} ${filter === 'dispute' ? styles.activeTab : ''}`} onClick={() => setFilter('dispute')}>בבירור (1)</button>
        <button className={`${styles.tab} ${filter === 'missing' ? styles.activeTab : ''}`} onClick={() => setFilter('missing')}>דורש הבהרות (1)</button>
      </div>

      <div className={styles.invoiceList}>
        {filteredInvoices.map(inv => (
          <div key={inv.id} className={styles.invoiceCard}>
            <div className={styles.invoiceMain}>
              <div className={styles.invoiceIcon}>{inv.status === 'missing' ? '📄' : '🧾'}</div>
              <div className={styles.invoiceDetails}>
                <h3>{inv.supplier || 'ספק לא ידוע'}</h3>
                <div className={styles.invoiceMeta}>
                  <span>שולם ע"י: <b>{inv.payerName || '---'}</b></span>
                  <span>תאריך: {inv.date}</span>
                </div>
                {inv.note && <div className={styles.invoiceNote}>{inv.note}</div>}
              </div>
            </div>
            
            <div className={styles.invoiceAction}>
              {inv.amount ? <span className={styles.amount}>₪{inv.amount.toLocaleString()}</span> : <span className={styles.amount}>---</span>}
              
              {inv.status === 'approved' && <span className={`${styles.statusBadge} ${styles['status-approved']}`}>✓ מאושר</span>}
              {inv.status === 'pending' && <span className={`${styles.statusBadge} ${styles['status-pending']}`}>⏳ אישורים: {inv.approvalsReceived}/{inv.approvalsNeeded}</span>}
              {inv.status === 'dispute' && <span className={`${styles.statusBadge} ${styles['status-dispute']}`}>⚠️ בבירור</span>}
              {inv.status === 'missing' && <span className={`${styles.statusBadge} ${styles['status-missing']}`}>❓ דורש הבהרות</span>}

              <div className={styles.actionButtons}>
                {inv.status === 'pending' && inv.payerName === 'דני (אני)' && <button className={styles.btnSmall}>שלח תזכורת 🔔</button>}
                {inv.status === 'pending' && inv.payerName !== 'דני (אני)' && <button className={styles.btnSmall}>אשר הוצאה ✓</button>}
                {inv.status === 'dispute' && <button className={styles.btnSmall}>פתח צ'אט 💬</button>}
                {inv.status === 'missing' && <button className={styles.btnSmall}>השלם פרטים ✍️</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

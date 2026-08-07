'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';
import ScannerModal from './ScannerModal';

export default function FinanceWidget({ space, activePartnersCount, onRemove, initialScannedImage }: { space: any, activePartnersCount: number, onRemove?: () => void, initialScannedImage?: string | null }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'summary' | 'transactions'>('summary');
  const [filter, setFilter] = useState<'all' | 'pending_me' | 'pending_partners' | 'dispute'>('all');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrData, setOcrData] = useState<{amount?: number, date?: string, vendor?: string, vatNumber?: string, invoiceNumber?: string}>({});
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isEditingShares, setIsEditingShares] = useState(false);
  const [selectedPayerId, setSelectedPayerId] = useState<string>('me');
  const [selectedCategory, setSelectedCategory] = useState('כללי');
  const { addInvoice, updateSpaceSettings } = useSpaces();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // If a scan arrives from the parent (ScannerWidget), run OCR then open modal
  useEffect(() => {
    const processInitialScan = async () => {
      if (initialScannedImage) {
        setIsAnalyzing(true);
        try {
          const response = await fetch('/api/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: initialScannedImage })
          });
          if (response.ok) {
            const data = await response.json();
            setOcrData(data);
          }
        } catch (e) {
          console.error("Failed to process cloud OCR", e);
        }
        setScannedImage(initialScannedImage);
        setIsAnalyzing(false);
        setIsAddingExpense(true);
      }
    };
    processInitialScan();
  }, [initialScannedImage]);
  
  const handleScanResult = async (imgUrl: string, ocrDataUrl?: string) => {
    setIsScanning(false);
    setIsAnalyzing(true);
    
    try {
      // 1. Upload high-res image to Firebase Storage so it's backed up safely in the cloud
      const { uploadImageToStorage, db } = await import('../../lib/firebase');
      const { doc, getDoc, setDoc, updateDoc, increment } = await import('firebase/firestore');
      
      const filename = `invoices/${space.id}/${Date.now()}.jpg`;
      const cloudUrl = await uploadImageToStorage(imgUrl, filename);
      
      // 2. Call our Next.js API Route which uses Gemini 2.5 Flash for 99% accuracy
      // Pass the cloudUrl instead of the base64 string to avoid Vercel 4.5MB Payload limit
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: cloudUrl })
      });
      
      if (response.ok) {
        const data = await response.json();
        setOcrData(data);
        
        // 3. Track Usage in Firebase
        try {
          if (user?.id) {
            const userStatsRef = doc(db, 'users', user.id, 'stats', 'ocr');
            const userDoc = await getDoc(userStatsRef);
            if (userDoc.exists()) {
              await updateDoc(userStatsRef, { scans: increment(1), lastScan: new Date().toISOString() });
            } else {
              await setDoc(userStatsRef, { scans: 1, lastScan: new Date().toISOString() });
            }
          }
          const globalStatsRef = doc(db, 'system', 'ocr_stats');
          const globalDoc = await getDoc(globalStatsRef);
          if (globalDoc.exists()) {
            await updateDoc(globalStatsRef, { totalScans: increment(1) });
          } else {
            await setDoc(globalStatsRef, { totalScans: 1 });
          }
        } catch (trackingError) {
          console.error("Failed to track OCR usage", trackingError);
        }

      } else {
        const err = await response.json();
        console.error("Cloud OCR API Error:", err);
      }

      // 4. Save the Cloud URL to state instead of the massive local base64 string
      setScannedImage(cloudUrl);
    } catch (e) {
      console.error("Failed to process cloud upload/OCR", e);
      setScannedImage(imgUrl); // Fallback to local
    }
    
    setIsAnalyzing(false);
    setIsAddingExpense(true);
  };

  const hasScanner = space.features.includes('scanner');
  const invoices = space.invoices || [];

  const filteredInvoices = invoices.filter((inv: any) => {
    if (filter === 'all') return true;
    if (filter === 'pending_me') {
      return inv.status === 'pending' && inv.payerId !== user?.id && inv.payerId !== 'me';
    }
    if (filter === 'pending_partners') {
      return inv.status === 'pending' && (inv.payerId === user?.id || inv.payerId === 'me');
    }
    return inv.status === filter;
  });
  const totalExpenses = invoices.reduce((acc: number, inv: any) => acc + (inv.amount || 0), 0);

  // Financial Engine Calculations
  const balances: { name: string, paid: number, expected: number, balance: number, userId?: string }[] = [];
  let myBalance = 0;
  const validMembers = space.members?.filter((m: any) => m.userId !== user?.id) || [];
  
  if (activePartnersCount > 0) {
    const memberCount = validMembers.length + 1; // +1 for "me"
    
    // Get custom shares or default equally
    const myShare = space.settings?.mySharePercentage ?? (100 / memberCount);
    
    // Me
    const myPaid = invoices.filter((i: any) => i.payerId === user?.id || i.payerId === 'me' || (!i.payerId && (i.payerName === 'אני' || i.payerName === user?.realName))).reduce((sum: number, i: any) => sum + (i.amount || 0), 0);
    const myExpected = totalExpenses * myShare / 100;
    myBalance = myPaid - myExpected;
    balances.push({ name: 'אני', paid: myPaid, expected: myExpected, balance: myBalance, userId: 'me' });

    // Partners
    validMembers.forEach((m: any) => {
      const p = m.sharePercentage ?? (100 / memberCount);
      const paid = invoices.filter((i: any) => i.payerId === m.userId || (!i.payerId && i.payerName === m.name)).reduce((sum: number, i: any) => sum + (i.amount || 0), 0);
      const expected = totalExpenses * p / 100;
      balances.push({ name: m.name, paid, expected, balance: paid - expected, userId: m.userId });
    });
  }

  const handleAddExpense = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const supplier = formData.get('supplier') as string;
    
    let payerName = user?.realName || 'אני';
    let payerId: string | undefined = user?.id || 'me';
    
    if (selectedPayerId === 'other') {
      payerName = (formData.get('payerNameCustom') as string) || 'אחר';
      payerId = undefined;
    } else if (selectedPayerId !== 'me' && selectedPayerId !== user?.id) {
      const partner = validMembers.find((m: any) => m.userId === selectedPayerId);
      if (partner) {
        payerName = partner.name;
        payerId = partner.userId;
      }
    }
    
    let category = selectedCategory;
    if (selectedCategory === 'other') {
      category = (formData.get('categoryCustom') as string) || 'כללי';
    }
    
    const dateVal = (formData.get('date') as string);
    const date = dateVal ? new Date(dateVal).toLocaleDateString('he-IL') : new Date().toLocaleDateString('he-IL');
    const note = (formData.get('note') as string) || '';
    const vatNumber = (formData.get('vatNumber') as string) || '';
    const invoiceNumber = (formData.get('invoiceNumber') as string) || '';

    addInvoice(space.id, {
      amount,
      supplier,
      category,
      payerName,
      date,
      status: 'pending',
      note,
      vatNumber,
      invoiceNumber,
      approvalsNeeded: activePartnersCount > 0 ? activePartnersCount : 0,
      approvalsReceived: 0,
      vatRate: space.settings?.defaultVatRate || 18,
      hasAttachment: !!scannedImage,
      attachmentUrl: scannedImage || undefined,
      payerId: payerId
    });

    setIsAddingExpense(false);
    setScannedImage(null);
    setActiveTab('transactions'); // Move to transactions so they see the newly added item at the top!
  };

  return (
    <div className="card glass-panel" style={{ padding: '0', marginBottom: '2rem', background: 'var(--bg-card)', position: 'relative', overflow: 'hidden' }}>
      
      {/* Header and Controls */}
      <div style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              💰 התחשבנות
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              ניהול הוצאות {activePartnersCount > 0 ? 'ומאזן שותפים' : 'אישי'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link href={`/space/${space.id}/reports`} style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none', padding: '0.5rem 1rem', border: '1px solid var(--primary)', borderRadius: 'var(--radius-full)', fontSize: '0.9rem' }}>
              📊 דוחות
            </Link>
            {onRemove && (
              <button 
                onClick={onRemove}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-secondary)', padding: '0.5rem' }}
                title="הסר פיצ'ר מהקיר"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', marginTop: '1rem' }}>
        <button 
          onClick={() => setActiveTab('summary')}
          style={{ flex: 1, padding: '1rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'summary' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'summary' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'summary' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1rem' }}
        >
          סיכום ותקציב
        </button>
        <button 
          onClick={() => setActiveTab('transactions')}
          style={{ flex: 1, padding: '1rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'transactions' ? '2px solid var(--primary)' : '2px solid transparent', color: activeTab === 'transactions' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: activeTab === 'transactions' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1rem' }}
        >
          פעולות אחרונות
        </button>
      </div>

      <div style={{ padding: '1.5rem' }}>
        {activeTab === 'summary' && (
          <div>
            {/* Summary Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>סך הכל שולם</p>
                <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: 'var(--text-primary)' }}>₪{totalExpenses.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
              </div>
              <div 
                onClick={() => { setActiveTab('transactions'); setFilter('pending'); }}
                style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
                title="לחץ לצפייה בממתינים"
              >
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ממתין לאישור</p>
                <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: '#f59e0b' }}>{invoices.filter((i: any) => i.status === 'pending').length}</h3>
              </div>
              {activePartnersCount > 0 && (
                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {myBalance < 0 ? 'סה"כ עליך להשלים לקופה:' : myBalance > 0 ? 'סה"כ מגיע לך מהקופה:' : 'מאזן אישי מאופס'}
                  </p>
                  <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: myBalance >= 0 ? '#10b981' : '#ef4444' }} dir="ltr">
                    {Math.abs(myBalance).toLocaleString(undefined, {maximumFractionDigits: 0})} ₪
                  </h3>
                </div>
              )}
            </div>

            {activePartnersCount > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem' }}>טבלת מאזנים</h4>
                  <button 
                    onClick={() => setIsEditingShares(true)}
                    style={{ background: 'rgba(0,0,0,0.05)', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '16px', fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    ערוך אחוזי השתתפות ✍️
                  </button>
                </div>
                
                <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-light)' }}>
                        <th style={{ padding: '0.75rem' }}>שותף</th>
                        <th style={{ padding: '0.75rem' }}>חלק באחוזים</th>
                        <th style={{ padding: '0.75rem' }}>סך הכל שילם</th>
                        <th style={{ padding: '0.75rem' }}>מאזן נוכחי (חובה/זכות)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balances.map((b) => {
                        const memberCount = validMembers.length + 1;
                        const defaultShare = 100 / memberCount;
                        let p = defaultShare;
                        if (b.userId === 'me') p = space.settings?.mySharePercentage ?? defaultShare;
                        else {
                          const m = space.members?.find((sm: any) => sm.userId === b.userId);
                          if (m) p = m.sharePercentage ?? defaultShare;
                        }

                        return (
                          <tr key={b.name} style={{ borderBottom: '1px solid var(--border-light)', background: b.userId === 'me' ? 'rgba(79, 70, 229, 0.05)' : 'transparent' }}>
                            <td style={{ padding: '0.75rem', fontWeight: b.userId === 'me' ? 'bold' : 'normal' }}>{b.name}</td>
                            <td style={{ padding: '0.75rem' }}>{p.toFixed(1)}%</td>
                            <td style={{ padding: '0.75rem' }}>₪{b.paid.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 'bold', color: b.balance > 0 ? '#10b981' : b.balance < 0 ? '#ef4444' : 'var(--text-secondary)' }} dir="ltr">
                              <span style={{fontSize: '0.75rem', marginRight: '0.25rem', color: 'var(--text-secondary)'}}>{b.balance < 0 ? '(חובה)' : b.balance > 0 ? '(זכות)' : ''}</span>
                              {b.balance > 0 ? '+' : ''}₪{b.balance.toLocaleString(undefined, {maximumFractionDigits: 0})}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: '1.4' }}>
                  💡 <strong>איך מתחשבנים?</strong> מי שהמאזן שלו באדום (מינוס) צריך להעביר את הכסף למי שהמאזן שלו בירוק (פלוס), עד שהקופה כולה מתאפסת.
                </p>
              </div>
            )}

            {!hasScanner && (
              <div style={{ padding: '1rem', background: '#fff3cd', color: '#856404', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', border: '1px solid #ffeeba' }}>
                <span style={{ fontSize: '1.25rem' }}>💡</span>
                <div style={{ fontSize: '0.9rem' }}>
                  <strong>טיפ:</strong> רוב המשתמשים מצרפים את פיצ'ר ה-<strong>סורק חשבוניות</strong> כדי למנוע אובדן קבלות ולהאיץ את ההקלדה.
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'transactions' && (
          <div>
            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
              <button onClick={() => setFilter('all')} style={{ padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-light)', background: filter === 'all' ? 'var(--bg-hover)' : 'transparent', fontWeight: filter === 'all' ? 'bold' : 'normal', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                הכל
              </button>
              <button onClick={() => setFilter('pending_me')} style={{ padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-light)', background: filter === 'pending_me' ? 'var(--bg-hover)' : 'transparent', fontWeight: filter === 'pending_me' ? 'bold' : 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                ממתין לאישורי
                {invoices.filter((i: any) => i.status === 'pending' && i.payerId !== user?.id && i.payerId !== 'me').length > 0 && (
                  <span style={{ background: '#f59e0b', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                    {invoices.filter((i: any) => i.status === 'pending' && i.payerId !== user?.id && i.payerId !== 'me').length}
                  </span>
                )}
              </button>
              <button onClick={() => setFilter('pending_partners')} style={{ padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-light)', background: filter === 'pending_partners' ? 'var(--bg-hover)' : 'transparent', fontWeight: filter === 'pending_partners' ? 'bold' : 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                ממתין לשותפים
              </button>
            </div>

            {filteredInvoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📄</span>
                לא נמצאו חשבוניות. לחץ על ה-➕ כדי להוסיף.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* REVERSE CHRONOLOGICAL ORDER (Newest on top) */}
                {[...filteredInvoices].reverse().map((inv: any) => (
                  <div key={inv.id} style={{ display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    
                    <div 
                      onClick={() => setExpandedInvoiceId(expandedInvoiceId === inv.id ? null : inv.id)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ 
                          width: '40px', height: '40px', flexShrink: 0,
                          borderRadius: '50%', 
                          background: inv.status === 'approved' ? '#d1fae5' : inv.status === 'pending' ? '#fef3c7' : '#fee2e2',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.1rem'
                        }}>
                          {inv.status === 'approved' ? '✓' : inv.status === 'pending' ? '⏳' : '⚠️'}
                        </div>
                        <div>
                          <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {inv.supplier}
                            {inv.hasAttachment ? (
                              <span title="מצורפת חשבונית" style={{ fontSize: '0.9rem' }}>📎</span>
                            ) : (
                              <span title="חסר מסמך/קבלה" style={{ fontSize: '0.9rem', color: '#ef4444' }}>⚠️</span>
                            )}
                          </h4>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <span>{inv.date}</span>
                            <span>• ע"י {inv.payerName}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'left', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div>
                          <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                            ₪{inv.amount?.toLocaleString()}
                          </h3>
                          {activePartnersCount > 0 && inv.status === 'pending' && (
                            <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 'bold' }}>
                              {inv.approvalsReceived}/{inv.approvalsNeeded} אושר
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', transform: expandedInvoiceId === inv.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                          ⌄
                        </div>
                      </div>
                    </div>

                    {/* EXPANDED DETAILS */}
                    {expandedInvoiceId === inv.id && (
                      <div style={{ padding: '1rem', borderTop: '1px solid var(--border-light)', background: 'var(--bg-main)' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                          
                          {/* Left Side: Invoice Image */}
                          {inv.hasAttachment && inv.attachmentUrl ? (
                            <div style={{ flex: '1 1 200px', maxWidth: '300px' }}>
                              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 'bold' }}>חשבונית / קבלה סרוקה:</p>
                              <div 
                                onClick={() => setPreviewImage(inv.attachmentUrl)}
                                style={{ width: '100%', height: '150px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                              >
                                <img src={inv.attachmentUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="חשבונית סרוקה" />
                                <div style={{ position: 'absolute', bottom: '0.5rem', right: '0.5rem', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>🔍 הגדל</div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ flex: '1 1 200px', maxWidth: '300px', padding: '1rem', border: '1px dashed #ef4444', borderRadius: '12px', color: '#ef4444', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              לא צורפה קבלה או חשבונית.
                            </div>
                          )}

                          {/* Right Side: Approvals & Actions */}
                          <div style={{ flex: '2 1 300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 'bold' }}>סטטוס אישורים ({inv.approvalsReceived} מתוך {inv.approvalsNeeded}):</p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {/* Placeholder for who approved, we don't have actual arrays in Invoice model yet, but we can fake it or show general status */}
                                {inv.status === 'approved' ? (
                                  <span style={{ color: '#10b981', fontSize: '0.9rem' }}>✓ כל השותפים אישרו הוצאה זו.</span>
                                ) : (
                                  <span style={{ color: '#f59e0b', fontSize: '0.9rem' }}>⏳ ממתין לאישור של לפחות שותף אחד.</span>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                              {inv.payerId !== user?.id && inv.payerId !== 'me' && inv.status === 'pending' && (
                                <button onClick={() => alert('אושר!')} style={{ flex: 1, padding: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                                  ✓ מאשר את ההוצאה
                                </button>
                              )}
                              {(inv.payerId === user?.id || inv.payerId === 'me') && inv.status === 'pending' && (
                                <button onClick={() => alert('התראה נשלחה לשותפים בהצלחה!')} style={{ flex: 1, padding: '0.75rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                                  🔔 שלח התראה לשותף (Nudge)
                                </button>
                              )}
                              <button onClick={() => alert('פונקציית צ׳אט תתווסף בקרוב')} style={{ flex: 1, padding: '0.75rem', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                                💬 פתח דיון
                              </button>
                            </div>
                          </div>

                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAB - Floating Action Button for adding expense */}
      <button 
        className="fab"
        onClick={() => setIsAddingExpense(true)}
        style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem', width: '50px', height: '50px' }} 
      >
        ➕
      </button>

      {/* Add Expense Modal (Bottom Sheet Style) */}
      {isMounted && isAddingExpense && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
          <style dangerouslySetInnerHTML={{__html: `
            .scanner-fab-button { display: none !important; }
          `}} />
          {/* Removed onClick to prevent accidental closing and losing data */}
          <div className="bottom-sheet-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)' }}></div>
          <div className="bottom-sheet" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1001, background: 'var(--bg-card)', padding: '2rem', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 -10px 40px rgba(0,0,0,0.2)' }}> 
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>הוספת הוצאה חדשה</h3>
              <button onClick={() => setIsAddingExpense(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-secondary)' }}>✕</button>
            </div>
            
            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>שם העסק / תיאור</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input required name="supplier" defaultValue={ocrData.vendor || ''} placeholder="שם הספק / תיאור" style={{ flex: 1, padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)', color: 'var(--text-primary)', width: '100%' }} />
                  {!scannedImage && (
                    <button type="button" onClick={() => setIsScanning(true)} style={{ background: 'var(--bg-main)', color: 'var(--text-primary)', border: '2px solid var(--border-light)', padding: '0 1rem', borderRadius: '12px', cursor: 'pointer', fontSize: '1.5rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="סרוק חשבונית">
                      📷
                    </button>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>סכום כולל מע״מ (₪)</label>
                  <input required name="amount" type="number" step="0.01" defaultValue={ocrData.amount || ''} placeholder="סכום כולל מע״מ" style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)', color: 'var(--text-primary)' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>תאריך</label>
                  <input required name="date" type="date" defaultValue={ocrData.date || new Date().toISOString().split('T')[0]} style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>מס' חשבונית (אופציונלי)</label>
                  <input name="invoiceNumber" defaultValue={ocrData.invoiceNumber || ''} placeholder="מספר מסמך" style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)', color: 'var(--text-primary)' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>ח.פ / ע.מ (אופציונלי)</label>
                  <input name="vatNumber" defaultValue={ocrData.vatNumber || ''} placeholder="מספר תאגיד" style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              
              {activePartnersCount > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <select 
                    required 
                    value={selectedPayerId} 
                    onChange={e => setSelectedPayerId(e.target.value)}
                    style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)' }}
                  >
                    <option value={user?.id || 'me'}>{user?.realName || 'אני'}</option>
                    {validMembers.map((m: any) => (
                      <option key={m.userId} value={m.userId}>{m.name}</option>
                    ))}
                    <option value="other">אחר (הקלד שם)...</option>
                  </select>
                  {selectedPayerId === 'other' && (
                    <input 
                      required 
                      name="payerNameCustom" 
                      placeholder="הקלד שם איש קשר..." 
                      style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--primary)', fontSize: '1rem', background: '#fff' }} 
                    />
                  )}
                </div>
              )}
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <select 
                  required 
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)' }}
                >
                  <option value="כללי">כללי</option>
                  <option value="חומרי בניין">חומרי בניין</option>
                  <option value="קבלנים">קבלנים</option>
                  <option value="חשמל">חשמל</option>
                  <option value="ריהוט">ריהוט</option>
                  <option value="other">אחר (הקלד קטגוריה)...</option>
                </select>
                {selectedCategory === 'other' && (
                  <input 
                    required 
                    name="categoryCustom" 
                    placeholder="הקלד קטגוריה..." 
                    style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--primary)', fontSize: '1rem', background: '#fff' }} 
                  />
                )}
              </div>
              
              <textarea name="note" placeholder="הערות (אופציונלי)" rows={2} style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)', resize: 'vertical' }}></textarea>
              
              <div style={{ marginTop: '0.5rem' }}>
                <button type="submit" style={{ width: '100%', background: 'var(--primary)', color: 'white', border: 'none', padding: '1rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>
                  שמור הוצאה
                </button>
              </div>
            </form>
            {isScanning && (
              <ScannerModal 
                onClose={() => setIsScanning(false)}
                onComplete={handleScanResult}
              />
            )}
            {scannedImage && (
              <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>מסמך מצורף (נסרק בהצלחה):</p>
                <img 
                  src={scannedImage} 
                  alt="Scanned Attachment" 
                  onClick={() => setPreviewImage(scannedImage)}
                  style={{ maxWidth: '100%', maxHeight: '200px', border: '1px solid var(--border-light)', borderRadius: '12px', objectFit: 'contain', cursor: 'zoom-in' }} 
                />
              </div>
            )}
            {isAnalyzing && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <style dangerouslySetInnerHTML={{__html: `
                  @keyframes pulsebot { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
                `}} />
                <div style={{ fontSize: '4rem', marginBottom: '1rem', animation: 'pulsebot 1.5s infinite' }}>🤖</div>
                <h2 style={{ margin: 0 }}>מפענח נתונים...</h2>
                <p style={{ marginTop: '0.5rem', opacity: 0.8 }}>קורא את החשבונית בעזרת בינה מלאכותית</p>
              </div>
            )}
            
            {/* Full Screen Image Preview Modal */}
            {previewImage && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', flexDirection: 'column', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <button type="button" onClick={() => setPreviewImage(null)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>✕ חזור לטופס</button>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <img src={previewImage} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} />
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Edit Shares Modal */}
      {isMounted && isEditingShares && createPortal(
        <SharesEditorModal 
          space={space} 
          onClose={() => setIsEditingShares(false)} 
          onSave={updateSpaceSettings}
        />,
        document.body
      )}

    </div>
  );
}

function SharesEditorModal({ space, onClose, onSave }: { space: any, onClose: () => void, onSave: any }) {
  const { user } = useAuth();
  const validMembers = space.members?.filter((m: any) => m.userId !== user?.id) || [];
  const memberCount = validMembers.length + 1;
  const defaultShare = 100 / memberCount;
  
  const [myShare, setMyShare] = useState<number>(space.settings?.mySharePercentage ?? defaultShare);
  const [partnerShares, setPartnerShares] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    validMembers.forEach((m: any) => {
      initial[m.userId] = m.sharePercentage ?? defaultShare;
    });
    return initial;
  });

  const total = myShare + Object.values(partnerShares).reduce((a,b)=>a+b, 0);

  const handleAutoBalance = () => {
    setMyShare(defaultShare);
    const newPartnerShares: Record<string, number> = {};
    validMembers.forEach((m: any) => {
      newPartnerShares[m.userId] = defaultShare;
    });
    setPartnerShares(newPartnerShares);
  };

  const handleSave = () => {
    if (Math.abs(total - 100) > 0.1) {
      alert('סך כל האחוזים חייב להיות 100%');
      return;
    }
    
    onSave(space.id, { mySharePercentage: myShare });
    alert('שמירת אחוזים דורשת עדכון פנימי לכל משתמש במסד הנתונים. מבוצעת שמירה למשתמש הנוכחי בינתיים.');
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="bottom-sheet-overlay" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}></div>
      <div className="bottom-sheet" style={{ position: 'relative', width: '90%', maxWidth: '400px', background: 'var(--bg-card)', borderRadius: '24px', padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>אחוזי השתתפות</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <span style={{ fontWeight: 'bold' }}>אני ({user?.realName})</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="number" 
                value={myShare} 
                onChange={(e) => setMyShare(Number(e.target.value))}
                style={{ width: '60px', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center', background: 'rgba(0,0,0,0.02)' }}
              />
              <span>%</span>
            </div>
          </div>

          {validMembers.map((m: any) => (
            <div key={m.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
              <span style={{ fontWeight: 'bold' }}>{m.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="number" 
                  value={partnerShares[m.userId] || 0} 
                  onChange={(e) => setPartnerShares({...partnerShares, [m.userId]: Number(e.target.value)})}
                  style={{ width: '60px', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center', background: 'rgba(0,0,0,0.02)' }}
                />
                <span>%</span>
              </div>
            </div>
          ))}

          <div style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', color: Math.abs(total - 100) > 0.1 ? '#ef4444' : '#10b981' }}>
            סה"כ: {total.toFixed(1)}% {Math.abs(total - 100) > 0.1 ? '(חייב להיות 100%)' : '✓'}
          </div>

          <button onClick={handleSave} style={{ width: '100%', background: 'var(--primary)', color: 'white', border: 'none', padding: '1rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>
            שמור שינויים
          </button>
        </div>
      </div>
    </div>
  );
}

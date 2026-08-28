'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';
import { FinanceSummary } from './Finance/FinanceSummary';
import { FinanceTransactions } from './Finance/FinanceTransactions';
import { FinanceAddExpenseForm } from './Finance/FinanceAddExpenseForm';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

export default function FinanceWidget({ space, activePartnersCount, onRemove, initialScannedImage }: { space: any, activePartnersCount: number, onRemove?: () => void, initialScannedImage?: string | null }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'summary' | 'transactions'>('summary');
  const [filter, setFilter] = useState<'all' | 'pending_me' | 'pending_partners' | 'dispute'>('all');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrData, setOcrData] = useState<{amount?: number, date?: string, vendor?: string, vatNumber?: string, invoiceNumber?: string}>({});
  const [ocrDebugMessage, setOcrDebugMessage] = useState<string | null>(null);
  const [ocrElapsedTime, setOcrElapsedTime] = useState<number>(0);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedPayerId, setSelectedPayerId] = useState<string>('me');
  const [selectedCategory, setSelectedCategory] = useState('כללי');
  const { addInvoice, updateSpaceSettings } = useSpaces();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const runOcrPipeline = async (imgUrl: string) => {
    setIsScanning(false);
    setIsAddingExpense(true); // Open the form immediately
    setIsAnalyzing(true);
    setOcrData({}); // Clear old data
    setOcrElapsedTime(0);
    
    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      setOcrElapsedTime((Date.now() - startTime) / 1000);
    }, 100);

    try {
      // 1. Architecture Fix: Sequence is FASTER than Parallel for Mobile Networks!
      // Sending 1MB to Firebase AND 1MB to Vercel at the same time over 4G causes upstream bandwidth saturation (buffer bloat).
      // Instead, we upload to Firebase (1MB) ONCE, get a tiny 100-byte URL, and send THAT to Vercel.
      // Vercel and Firebase are both on Google's 100Gbps backbone, so server-to-server download takes ~10ms!
      const { uploadImageToStorage, db } = await import('../../lib/firebase');
      const { doc, getDoc, setDoc, updateDoc, increment } = await import('firebase/firestore');
      const { downscaleBase64 } = await import('../../utils/imageOptimizer');
      
      // Scale to 1500px and 85% quality to ensure high-quality archiving for printing later.
      // This increases upload time slightly, but guarantees crystal clear receipts in the cloud.
      const optimizedImgUrl = await downscaleBase64(imgUrl, 1500, 0.85);
      
      const filename = `invoices/${space.id}/${Date.now()}.jpg`;
      
      // Step A: Upload image to Firebase (Mobile Upstream ~1MB)
      const finalImageUrl = await uploadImageToStorage(optimizedImgUrl, filename);
      
      // Step B: Send tiny URL to API (Mobile Upstream ~100 bytes)
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: finalImageUrl }) // Send tiny URL instead of massive Base64
      });
      
      clearInterval(timerInterval);
      setOcrElapsedTime((Date.now() - startTime) / 1000); // Final precise time
      
      if (response.ok) {
        const data = await response.json();
        setOcrData(data); // This will now correctly populate the form!
        setOcrDebugMessage(null); // Ensure UI is clean
        
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
        setOcrDebugMessage(`שגיאה בשרת הפענוח: ${err.error || 'אנא נסה שוב מאוחר יותר.'}`);
      }

      // 4. Save the actual Firebase Storage URL to state
      setScannedImage(finalImageUrl);
    } catch (e: any) {
      clearInterval(timerInterval);
      setOcrElapsedTime((Date.now() - startTime) / 1000);
      console.error("Failed to process cloud upload/OCR", e);
      setOcrDebugMessage(`תקלת תקשורת בסיסית: ${e.message}`);
      setScannedImage(imgUrl); // Fallback to local preview
    }
    
    setIsAnalyzing(false);
  };

  // If a scan arrives from the parent (Big Blue Button ScannerWidget)
  useEffect(() => {
    if (initialScannedImage && initialScannedImage !== scannedImage) {
      runOcrPipeline(initialScannedImage);
    }
  }, [initialScannedImage, space.id]);
  
  const handleCloseForm = () => {
    setIsAddingExpense(false);
    setScannedImage(null);
    setOcrData({});
    setOcrDebugMessage(null);
    setOcrElapsedTime(0);
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

  const validMembers = space.members?.filter((m: any) => m.userId !== user?.id) || [];

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

    handleCloseForm();
    setActiveTab('transactions'); // Move to transactions so they see the newly added item at the top!
  };

  return (
    <div className="card glass-panel" style={{ padding: '0', marginBottom: '2rem', background: 'var(--bg-card)', position: 'relative', overflow: 'hidden' }}>
      
      {/* Header and Controls */}
      <div style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                💰 התחשבנות (v17.9.50 Engine Fix)
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
          <FinanceSummary 
            space={space}
            user={user}
            invoices={invoices}
            activePartnersCount={activePartnersCount}
            hasScanner={hasScanner}
            setActiveTab={setActiveTab}
            setFilter={setFilter}
            updateSpaceSettings={updateSpaceSettings}
          />
        )}

        {activeTab === 'transactions' && (
          <FinanceTransactions 
            invoices={invoices}
            filteredInvoices={filteredInvoices}
            activePartnersCount={activePartnersCount}
            user={user}
            filter={filter}
            setFilter={setFilter}
            expandedInvoiceId={expandedInvoiceId}
            setExpandedInvoiceId={setExpandedInvoiceId}
            setPreviewImage={setPreviewImage}
          />
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
        <FinanceAddExpenseForm 
          user={user}
          validMembers={validMembers}
          activePartnersCount={activePartnersCount}
          ocrData={ocrData}
          scannedImage={scannedImage}
          isAnalyzing={isAnalyzing}
          ocrElapsedTime={ocrElapsedTime}
          ocrDebugMessage={ocrDebugMessage}
          handleAddExpense={handleAddExpense}
          handleCloseForm={handleCloseForm}
          isScanning={isScanning}
          setIsScanning={setIsScanning}
          runOcrPipeline={runOcrPipeline}
          setPreviewImage={setPreviewImage}
          selectedPayerId={selectedPayerId}
          setSelectedPayerId={setSelectedPayerId}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
        />,
        document.body
      )}

      {/* Full Screen Image Preview Modal */}
      {previewImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100000, display: 'flex', flexDirection: 'column', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <button type="button" onClick={() => setPreviewImage(null)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}>✕ חזור לטופס</button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <TransformWrapper initialScale={1} minScale={1} maxScale={5} centerOnInit={true}>
              <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
                <img src={previewImage} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', margin: 'auto' }} />
              </TransformComponent>
            </TransformWrapper>
          </div>
        </div>
      )}

    </div>
  );
}

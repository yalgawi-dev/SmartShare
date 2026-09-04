'use client';

import { PartnersInviteModal } from './Partners/PartnersInviteModal';
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';
import { FinanceSummary } from './Finance/FinanceSummary';
import { FinanceTransactions } from './Finance/FinanceTransactions';
import { FinanceAddExpenseForm } from './Finance/FinanceAddExpenseForm';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

const FinanceWidget = forwardRef(({ space, activePartnersCount, onRemove, isAddingExpense, setIsAddingExpense }: { space: any, activePartnersCount: number, onRemove?: () => void, isAddingExpense?: boolean, setIsAddingExpense?: (v: boolean) => void }, ref) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'summary' | 'transactions'>('summary');
  useImperativeHandle(ref, () => ({
    processScan: (url: string) => {
      runOcrPipeline(url);
    }
  }));

  const [filter, setFilter] = useState<'all' | 'pending_me' | 'pending_partners' | 'dispute' | 'archive'>('all');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrData, setOcrData] = useState<{amount?: number, date?: string, vendor?: string, clientName?: string, vatNumber?: string, invoiceNumber?: string}>({});
  const [ocrDebugMessage, setOcrDebugMessage] = useState<string | null>(null);
  const [ocrElapsedTime, setOcrElapsedTime] = useState<number>(0);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [selectedPayerId, setSelectedPayerId] = useState<string>('me');
  const [selectedCategory, setSelectedCategory] = useState('כללי');
  const { addInvoice, updateInvoice, updateSpaceSettings, updateSharesBulk } = useSpaces();

  
  const [showInviteModal, setShowInviteModal] = useState(false);

  const handleInviteClick = () => {
    setShowInviteModal(true);
  };

  
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setShowFabMenu(false);
      const reader = new FileReader();
      reader.onload = (ev) => {
         const url = ev.target?.result as string;
         setScannedImage(url);
         runOcrPipeline(url);
      };
      reader.readAsDataURL(file);
    }
  };
const [isMounted, setIsMounted] = useState(false);
  const uploadPromiseRef = useRef<Promise<string> | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  
  

const runOcrPipeline = async (imgUrl: string) => {
    setIsScanning(false);
    if(setIsAddingExpense) setIsAddingExpense(true); // Open the form immediately
    setIsAnalyzing(true);
    setOcrData({}); // Clear old data
    setOcrElapsedTime(0);
    
    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      setOcrElapsedTime((Date.now() - startTime) / 1000);
    }, 100);

    try {
      const { uploadImageToStorage, db } = await import('../../lib/firebase');
      const { doc, getDoc, setDoc, updateDoc, increment } = await import('firebase/firestore');
      const { downscaleBase64 } = await import('../../utils/imageOptimizer');
      
      // --- TRACK A (Foreground): The 40KB OCR Micro-Payload ---
      // Scale down aggressively (800px, 60% quality) just for the AI.
      // This guarantees an instant upload to Vercel (fraction of a second) even on a terrible 3G connection!
      const ocrPayload = await downscaleBase64(imgUrl, 800, 0.60);
      
      // --- TRACK B (Background): The High Quality Archive ---
      // Scale to 1500px, 85% quality. Will be uploaded silently in the background.
      const archiveImgUrl = await downscaleBase64(imgUrl, 1500, 0.85);
      const filename = `invoices/${space.id}/${Date.now()}.jpg`;
      
      // 1. Kick off the heavy Firebase upload, but DO NOT WAIT FOR IT!
      uploadPromiseRef.current = uploadImageToStorage(archiveImgUrl, filename).then(url => {
         setScannedImage(url); // Update state when finished silently
         return url;
      });
      
      // Temporarily set the local preview so the user sees the image immediately
      setScannedImage(imgUrl);
      
      // 2. Immediately send the microscopic payload to Vercel and block ONLY on this!
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: ocrPayload, vatRate: space?.settings?.defaultVatRate || 17 }) // We send the raw base64. The API route accepts this!
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
    } catch (e: any) {
      clearInterval(timerInterval);
      setOcrElapsedTime((Date.now() - startTime) / 1000);
      console.error("Failed to process cloud upload/OCR", e);
      setOcrDebugMessage(`תקלת תקשורת בסיסית: ${e.message}`);
      setScannedImage(imgUrl); // Fallback to local preview
    }
    
    setIsAnalyzing(false);
  };

  
  
  const handleCloseForm = () => {
    if(setIsAddingExpense) setIsAddingExpense(false);
    setScannedImage(null);
    
    setOcrData({});
    setOcrDebugMessage(null);
    setOcrElapsedTime(0);
  };

  const hasScanner = space.features.includes('scanner');

  const myId = user?.id || 'unknown_user';
  
  // STRICT ARCHITECTURE: We trust the database. No magical name matching in the UI.
  // The UI receives exactly what is in the DB. payerId is the ONLY source of truth.
  const invoices = space.invoices || [];

  const filteredInvoices = invoices.filter((inv: any) => {
    if (filter === 'archive') return inv.isActive === false;
    if (inv.isActive === false) return false;
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

  const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    let amount = Number(formData.get('amount'));
      const isCredit = formData.get('isCredit') === 'true';
      const isStoreCredit = formData.get('isStoreCredit') === 'true';
      if (isCredit) {
        amount = -Math.abs(amount);
      }
    const supplier = formData.get('supplier') as string;
    const clientName = formData.get('clientName') as string;
    
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
      
      const existingCategories = space.settings?.customCategories || [];
      if (!existingCategories.includes(category)) {
        updateSpaceSettings(space.id, { customCategories: [...existingCategories, category] });
      }
    }
    
    const dateVal = (formData.get('date') as string);
    const date = dateVal ? new Date(dateVal).toLocaleDateString('he-IL') : new Date().toLocaleDateString('he-IL');
    const note = (formData.get('note') as string) || '';
    const vatNumber = (formData.get('vatNumber') as string) || '';
    const invoiceNumber = (formData.get('invoiceNumber') as string) || '';
    const documentType = (formData.get('documentType') as string) || null;
      // If the user clicks Save BEFORE the background upload is done, we wait for it!
    let finalAttachmentUrl = scannedImage;
    if (uploadPromiseRef.current) {
      try {
        finalAttachmentUrl = await uploadPromiseRef.current;
        uploadPromiseRef.current = null; // Clear it out
      } catch (err) {
        console.error("Background upload failed", err);
      }
    }

    const myApproval = 1; // The person uploading inherently approves it
    const expenseApprovalsNeeded = activePartnersCount > 0 ? activePartnersCount + 1 : 0;
    
    const isTransfer = category === 'העברה/קיזוז';
    let targetId = undefined;
    if (isTransfer) {
      targetId = formData.get('targetId') as string;
      if (targetId === 'me') targetId = user?.id || 'me';
    }

    const finalApprovalsNeeded = isTransfer ? 1 : expenseApprovalsNeeded;
    const finalApprovalsReceived = isTransfer ? 0 : (finalApprovalsNeeded > 0 ? myApproval : 0);
    const finalStatus = isTransfer ? 'pending' : (finalApprovalsNeeded === 0 ? 'approved' : (myApproval >= finalApprovalsNeeded ? 'approved' : 'pending'));

    const newInvoice: any = {
      type: isTransfer ? 'transfer' : 'expense',
      amount,
        isCredit,
        isStoreCredit,
        supplier,
        clientName,
        category,
      payerName,
      date,
      createdAt: new Date().toISOString(),
      status: finalStatus,
      note,
      vatNumber,
      invoiceNumber,
      documentType,
      approvalsNeeded: finalApprovalsNeeded,
      approvalsReceived: finalApprovalsReceived,
      approvedBy: isTransfer ? [] : (user?.id ? [user.id] : []),
      vatRate: space.settings?.defaultVatRate || 18,
      hasAttachment: !!finalAttachmentUrl,
      payerId: payerId
    };

    if (isTransfer && targetId) {
      newInvoice.targetId = targetId;
    }
    if (finalAttachmentUrl) {
      newInvoice.attachmentUrl = finalAttachmentUrl;
    }

    addInvoice(space.id, newInvoice);

    handleCloseForm();
    setActiveTab('transactions'); // Move to transactions so they see the newly added item at the top!
    
    setToastMsg('ההוצאה נוספה בהצלחה!');
    setTimeout(() => setToastMsg(null), 3000);
  };

  return (
    <div className="card glass-panel" style={{ padding: '0', marginBottom: '2rem', background: 'var(--bg-card)', position: 'relative', overflow: 'hidden' }}>
      
      {toastMsg && (
        <div style={{ position: 'fixed', top: '10%', left: '50%', transform: 'translateX(-50%)', background: '#10b981', color: 'white', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-full)', zIndex: 100000, boxShadow: 'var(--shadow-lg)', fontWeight: 'bold', animation: 'fadeIn 0.3s ease-out' }}>
          ✓ {toastMsg}
        </div>
      )}

      
      {/* Header and Controls */}
      <div style={{ padding: '1.5rem', paddingBottom: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'var(--primary-light, rgba(59, 130, 246, 0.1))', color: 'var(--primary)', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
              💳
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-primary)', fontWeight: '800', letterSpacing: '-0.02em' }}>
                חשבוניות והתחשבנויות (v1.1)
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.15rem 0 0 0' }}>
                {activePartnersCount > 0 ? 'ניהול משותף עם שותפים למרחב' : 'ניהול הוצאות אישיות'}
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {space.features?.includes('partners') && (
              <button 
                onClick={handleInviteClick}
                style={{ 
                  background: 'var(--bg-main)', 
                  color: 'var(--primary)', 
                  border: '1px solid var(--border-light)', 
                  padding: '0.4rem 1rem', 
                  borderRadius: 'var(--radius-full)', 
                  fontWeight: '600', 
                  cursor: 'pointer', 
                  fontSize: '0.85rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.4rem', 
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.2s'
                }}
              >
                <span>👥</span>
                הזמן שותפים
              </button>
            )}
            {onRemove && (
              <button 
                onClick={onRemove}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-secondary)', padding: '0.5rem' }}
                title="הסרת תצוגת הכלי"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      
      {/* TABS - Apple/Vercel Style Segmented Control */}
      <div style={{ padding: '0 1.5rem', marginTop: '1rem', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', background: 'var(--bg-main)', padding: '0.25rem', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
          <button 
            onClick={() => setActiveTab('summary')}
            style={{ 
              flex: 1, 
              padding: '0.6rem 1rem', 
              background: activeTab === 'summary' ? 'var(--bg-card)' : 'transparent', 
              border: 'none', 
              borderRadius: '8px',
              color: activeTab === 'summary' ? 'var(--text-primary)' : 'var(--text-secondary)', 
              fontWeight: activeTab === 'summary' ? 'bold' : 'normal', 
              cursor: 'pointer', 
              fontSize: '0.95rem',
              boxShadow: activeTab === 'summary' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            📊 סיכום ומאזן
          </button>
          <button 
            onClick={() => setActiveTab('transactions')}
            style={{ 
              flex: 1, 
              padding: '0.6rem 1rem', 
              background: activeTab === 'transactions' ? 'var(--bg-card)' : 'transparent', 
              border: 'none', 
              borderRadius: '8px',
              color: activeTab === 'transactions' ? 'var(--text-primary)' : 'var(--text-secondary)', 
              fontWeight: activeTab === 'transactions' ? 'bold' : 'normal', 
              cursor: 'pointer', 
              fontSize: '0.95rem',
              boxShadow: activeTab === 'transactions' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            🧾 פירוט הוצאות
          </button>
        </div>
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
            updateSharesBulk={updateSharesBulk}
          />
        )}

        {activeTab === 'transactions' && (
          <FinanceTransactions 
            invoices={invoices}
            filteredInvoices={filteredInvoices}
            activePartnersCount={activePartnersCount}
            user={user}
            space={space}
            updateInvoice={updateInvoice}
            filter={filter}
            setFilter={setFilter}
            expandedInvoiceId={expandedInvoiceId}
            setExpandedInvoiceId={setExpandedInvoiceId}
            setPreviewImage={setPreviewImage}
          />
        )}
      </div>

      
      
      {/* Hidden File Input */}




      {/* Add Expense Modal (Bottom Sheet Style) */}
      {isMounted && isAddingExpense && createPortal(
        <FinanceAddExpenseForm 
          user={user}
          validMembers={validMembers}
          activePartnersCount={activePartnersCount}
          customCategories={space.settings?.customCategories}
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
      {previewImage && isMounted && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 999999, display: 'flex', flexDirection: 'column' }}>
          
          <button 
            type="button" 
            onClick={() => setPreviewImage(null)} 
            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(255, 255, 255, 0.2)', border: '2px solid white', color: 'white', width: '50px', height: '50px', borderRadius: '50%', fontSize: '1.5rem', cursor: 'pointer', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '3px' }}
            title="סגור תצוגה"
          >
            ✕
          </button>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} onClick={() => setPreviewImage(null)}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', height: '100%' }}>
              <TransformWrapper initialScale={1} minScale={1} maxScale={5} centerOnInit={true}>
                <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
                  <img src={previewImage} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', margin: 'auto' }} />
                </TransformComponent>
              </TransformWrapper>
            </div>
          </div>
        </div>,
        document.body
      )}

    
      {showInviteModal && <PartnersInviteModal space={space} onClose={() => setShowInviteModal(false)} />}
      {showInviteModal && <PartnersInviteModal space={space} onClose={() => setShowInviteModal(false)} />}
    </div>
  );
});

export default FinanceWidget;
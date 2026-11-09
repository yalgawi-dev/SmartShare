'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Invoice, InboxItem, useSpaces } from '../../../app/context/SpacesContext';
import { useAuth } from '../../../app/context/AuthContext';
import {
  matchInvoiceToExpenses,
  matchExpenseToInvoices,
  scorePair,
  MatchResult,
  MatchableDoc,
} from '../../../utils/invoiceMatcher';
import { downscaleBase64, extractPdfPages } from '../../../utils/imageOptimizer';
import { uploadImageToStorage, uploadBlobToStorage } from '../../../lib/firebase';
import PdfThumbnail from '../../shared/PdfThumbnail';
import UniversalViewerModal, { ViewerDocument } from '../../common/ViewerEngine/UniversalViewerModal';

export interface ScannedReceiptInput {
  /** Base64 or uploaded URL (first page / single image) */
  url: string;
  /** Optional pages array if multi-page */
  pages?: string[];
  /** Optional raw original PDF URL (preserved for digitally signed or vector original invoices) */
  rawPdfUrl?: string;
  /** Optional raw original PDF Blob for background upload */
  rawPdfBlob?: Blob;
  /** Optional pre-extracted OCR data (e.g. from InboxItem) */
  ocrData?: {
    amount?: number | string | null;
    vendor?: string | null;
    supplier?: string | null;
    date?: string | null;
    invoiceNumber?: string | null;
    vatNumber?: string | null;
  };
  /** Optional inbox item ID to clean up after attaching */
  inboxItemId?: string;
}

interface InvoiceAttachMatchModalProps {
  space: any;
  /**
   * Direction 1: user has 1 or more scanned receipts and wants to attach each to an existing expense without receipt.
   */
  receiptQueue?: ScannedReceiptInput[];
  /**
   * Direction 2: user clicked "מצא חשבונית" on an existing expense without receipt, and wants to match against waiting inbox items (or upload a file).
   */
  targetExpense?: Invoice;
  onClose: () => void;
  /** Fallback callback if the user decides a receipt is actually a brand-new expense */
  onFallbackToNewExpense?: (receipt: ScannedReceiptInput) => void;
  /** Optional callback to open camera/upload when in Direction 2 and user wants to scan a new file directly */
  onScanNewForExpense?: (expense: Invoice) => void;
}

export default function InvoiceAttachMatchModal({
  space,
  receiptQueue,
  targetExpense,
  onClose,
  onFallbackToNewExpense,
  onScanNewForExpense,
}: InvoiceAttachMatchModalProps) {
  const { attachFileToInvoice, removeInboxItem } = useSpaces();
  const { user } = useAuth();

  // Queue index when processing multiple receipts one by one
  const [queueIdx, setQueueIdx] = useState(0);
  const currentReceipt = receiptQueue && receiptQueue.length > 0 ? receiptQueue[queueIdx] : undefined;

  // OCR & upload state for Direction 1
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [extractedDoc, setExtractedDoc] = useState<MatchableDoc>({});
  const [uploadedUrls, setUploadedUrls] = useState<{ url: string; pages?: string[] } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [localFirstPageThumb, setLocalFirstPageThumb] = useState<string | null>(null);

  // Selected candidate ID (expense ID in Direction 1, inbox item ID in Direction 2)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAllManual, setShowAllManual] = useState(false);
  const [manualSearch, setManualSearch] = useState('');
  const [applyAmountUpdate, setApplyAmountUpdate] = useState(false);

  // Full-screen preview via UniversalViewerModal
  const [previewDoc, setPreviewDoc] = useState<ViewerDocument | null>(null);

  // Active expenses without attachment in this space
  const unattachedExpenses: Invoice[] = useMemo(() => {
    return (space?.invoices || []).filter(
      (inv: any) =>
        inv.isActive !== false &&
        inv.type !== 'transfer' &&
        inv.type !== 'income' &&
        inv.category !== 'cashbox_equity' &&
        inv.category !== 'cashbox_withdrawal' &&
        !inv.hasAttachment
    );
  }, [space?.invoices]);

  // Waiting inbox items in this space (Direction 2)
  const waitingInboxItems: InboxItem[] = useMemo(() => {
    return (space?.inboxItems || []).filter((item: any) => item.status !== 'irrelevant');
  }, [space?.inboxItems]);

  // Run OCR + background WebP page upload whenever currentReceipt changes (Direction 1)
  useEffect(() => {
    if (!currentReceipt) return;
    let cancelled = false;

    const prepareReceipt = async () => {
      setSelectedId(null);
      setShowAllManual(false);
      setApplyAmountUpdate(false);
      setUploadedUrls(null);
      setLocalFirstPageThumb(null);

      // If OCR data was already provided (e.g. from Inbox), use it immediately
      if (currentReceipt.ocrData) {
        const rawAmt = currentReceipt.ocrData.amount;
        const parsedAmt =
          rawAmt != null && rawAmt !== ''
            ? Number(String(rawAmt).replace(/[^\d.-]/g, ''))
            : null;
        setExtractedDoc({
          amount: parsedAmt && !isNaN(parsedAmt) ? parsedAmt : null,
          supplier: currentReceipt.ocrData.vendor || currentReceipt.ocrData.supplier || null,
          date: currentReceipt.ocrData.date || null,
          invoiceNumber: currentReceipt.ocrData.invoiceNumber || null,
          vatNumber: currentReceipt.ocrData.vatNumber || null,
        });
      } else {
        setExtractedDoc({});
      }

      setIsScanningOcr(true);
      try {
        const rawUri = currentReceipt.url;
        const isPdf = rawUri.startsWith('data:application/pdf') || rawUri.includes('application/pdf') || rawUri.toLowerCase().includes('.pdf');

        // 1. Convert to separate WebP pages if needed (never store raw PDF)
        let webpPages: string[] = [];
        if (currentReceipt.pages && currentReceipt.pages.length > 0) {
          webpPages = currentReceipt.pages;
        } else if (isPdf) {
          webpPages = await extractPdfPages(rawUri, 1500, 0.85);
        }

        if (webpPages.length === 0) {
          if (rawUri.startsWith('data:')) {
            webpPages = [await downscaleBase64(rawUri, 1500, 0.85)];
          } else {
            webpPages = [rawUri];
          }
        }

        if (webpPages.length > 0 && !cancelled) {
          setLocalFirstPageThumb(webpPages[0]);
        }

        // 2. Run OCR if we don't already have OCR fields
        if (!currentReceipt.ocrData) {
          const ocrThumb = webpPages[0].startsWith('data:')
            ? await downscaleBase64(webpPages[0], 800, 0.65)
            : webpPages[0];
          const res = await fetch('/api/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl: ocrThumb,
              vatRate: space?.settings?.defaultVatRate || 18,
            }),
          });
          if (res.ok && !cancelled) {
            const data = await res.json();
            const parsedAmt =
              data?.amount != null && data.amount !== ''
                ? Number(String(data.amount).replace(/[^\d.-]/g, ''))
                : null;
            setExtractedDoc({
              amount: parsedAmt && !isNaN(parsedAmt) ? parsedAmt : null,
              supplier: data?.vendor || data?.supplier || null,
              date: data?.date || null,
              invoiceNumber: data?.invoiceNumber || null,
              vatNumber: data?.vatNumber || null,
            });
          }
        }

        // 3. Upload pages to Firebase Storage as WebP
        const finalPages: string[] = [];
        for (let i = 0; i < webpPages.length; i++) {
          const pUri = webpPages[i];
          if (pUri.startsWith('data:')) {
            const path = `invoices/${space.id}/${Date.now()}-${i}-${Math.random().toString(36).substring(7)}.webp`;
            finalPages.push(await uploadImageToStorage(pUri, path));
          } else {
            finalPages.push(pUri);
          }
        }
        if (!cancelled) {
          setUploadedUrls({
            url: finalPages[0],
            pages: finalPages.length > 1 ? finalPages : undefined,
          });
        }
      } catch (err) {
        console.error('Receipt preparation failed:', err);
      } finally {
        if (!cancelled) setIsScanningOcr(false);
      }
    };

    prepareReceipt();
    return () => {
      cancelled = true;
    };
  }, [currentReceipt, space?.id, space?.settings?.defaultVatRate]);

  // Ranked matches for Direction 1 (Receipt -> Unattached Expenses)
  const expenseMatches: MatchResult<Invoice>[] = useMemo(() => {
    if (!currentReceipt) return [];
    const ranked = matchInvoiceToExpenses(extractedDoc, unattachedExpenses, { minScore: 30, limit: 5 });
    return ranked;
  }, [currentReceipt, extractedDoc, unattachedExpenses]);

  // Ranked matches for Direction 2 (Target Expense -> Waiting Inbox Items)
  const inboxMatches: MatchResult<InboxItem>[] = useMemo(() => {
    if (!targetExpense) return [];
    const candidates = waitingInboxItems.map((it) => {
      const rawAmt = it.ocrData?.amount;
      const amt = rawAmt != null ? Number(String(rawAmt).replace(/[^\d.-]/g, '')) : null;
      return {
        ...it,
        amount: amt && !isNaN(amt) ? amt : null,
        supplier: (it.ocrData as any)?.vendor || (it.ocrData as any)?.supplier || null,
        date: it.ocrData?.date || null,
        invoiceNumber: it.ocrData?.invoiceNumber || null,
        vatNumber: it.ocrData?.vatNumber || null,
      };
    });
    return matchExpenseToInvoices(targetExpense, candidates, { minScore: 25, limit: 5 });
  }, [targetExpense, waitingInboxItems]);

  // Auto-select top candidate when results arrive
  useEffect(() => {
    if (currentReceipt && expenseMatches.length > 0 && !selectedId) {
      setSelectedId(expenseMatches[0].item.id);
    } else if (targetExpense && inboxMatches.length > 0 && !selectedId) {
      setSelectedId(inboxMatches[0].item.id);
    }
  }, [currentReceipt, targetExpense, expenseMatches, inboxMatches, selectedId]);

  // Currently selected comparison pair
  const activeComparison = useMemo(() => {
    if (currentReceipt) {
      const exp = unattachedExpenses.find((e) => e.id === selectedId);
      if (!exp) return null;
      const scored = scorePair(extractedDoc, exp);
      return {
        expense: exp,
        invoiceDoc: extractedDoc,
        score: scored.score,
        level: scored.level,
        signals: scored.signals,
        amountDiff: scored.amountDiff,
        inboxItem: undefined as InboxItem | undefined,
      };
    }
    if (targetExpense) {
      const item = waitingInboxItems.find((i) => i.id === selectedId);
      if (!item) return null;
      const rawAmt = item.ocrData?.amount;
      const amt = rawAmt != null ? Number(String(rawAmt).replace(/[^\d.-]/g, '')) : null;
      const invDoc: MatchableDoc = {
        amount: amt && !isNaN(amt) ? amt : null,
        supplier: (item.ocrData as any)?.vendor || (item.ocrData as any)?.supplier || null,
        date: item.ocrData?.date || null,
        invoiceNumber: item.ocrData?.invoiceNumber || null,
        vatNumber: item.ocrData?.vatNumber || null,
      };
      const scored = scorePair(invDoc, targetExpense);
      return {
        expense: targetExpense,
        invoiceDoc: invDoc,
        score: scored.score,
        level: scored.level,
        signals: scored.signals,
        amountDiff: scored.amountDiff,
        inboxItem: item,
      };
    }
    return null;
  }, [currentReceipt, targetExpense, selectedId, unattachedExpenses, waitingInboxItems, extractedDoc]);

  const advanceOrClose = () => {
    if (receiptQueue && queueIdx < receiptQueue.length - 1) {
      setQueueIdx((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handleConfirmAttach = async () => {
    if (!activeComparison) return;
    setIsSaving(true);
    try {
      const performer = {
        id: user?.id || 'me',
        name: user?.nickname || user?.realName || 'משתמש',
      };

      let finalUrl = '';
      let finalPages: string[] | undefined = undefined;

      if (currentReceipt) {
        if (uploadedUrls) {
          finalUrl = uploadedUrls.url;
          finalPages = uploadedUrls.pages;
        } else {
          // Upload now if background upload hasn't finished yet
          const raw = currentReceipt.url;
          const path = `invoices/${space.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;
          finalUrl = raw.startsWith('data:') ? await uploadImageToStorage(raw, path) : raw;
          finalPages = currentReceipt.pages;
        }
      } else if (activeComparison.inboxItem) {
        finalUrl = activeComparison.inboxItem.imageUrl;
      }

      const newAmount =
        applyAmountUpdate && activeComparison.invoiceDoc.amount != null
          ? activeComparison.invoiceDoc.amount
          : undefined;

      let finalRawPdfUrl = currentReceipt?.rawPdfUrl;
      if (!finalRawPdfUrl && currentReceipt?.rawPdfBlob) {
        try {
          const rawPdfPath = `invoices/${space.id}/${Date.now()}_original.pdf`;
          finalRawPdfUrl = await uploadBlobToStorage(currentReceipt.rawPdfBlob, rawPdfPath);
        } catch (err) {
          console.warn('Background raw PDF upload in modal failed:', err);
        }
      }

      attachFileToInvoice(
        space.id,
        activeComparison.expense.id,
        { url: finalUrl, pages: finalPages, rawPdfUrl: finalRawPdfUrl, newAmount },
        performer
      );

      // Remove from project inbox if it came from there
      const inboxIdToRemove = currentReceipt?.inboxItemId || activeComparison.inboxItem?.id;
      if (inboxIdToRemove) {
        removeInboxItem(space.id, inboxIdToRemove);
      }

      advanceOrClose();
    } catch (e) {
      console.error('Failed to attach invoice:', e);
      alert('שגיאה בצירוף החשבונית. נסה שוב.');
    } finally {
      setIsSaving(false);
    }
  };

  if (typeof document === 'undefined') return null;

  const badgeColor = (level: 'high' | 'medium' | 'low') => {
    if (level === 'high') return { bg: '#dcfce7', text: '#166534', border: '#86efac' };
    if (level === 'medium') return { bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
    return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
  };

  const manualFilteredExpenses = unattachedExpenses.filter((e) => {
    if (!manualSearch.trim()) return true;
    const q = manualSearch.toLowerCase();
    return (
      (e.supplier || '').toLowerCase().includes(q) ||
      String(e.amount || '').includes(q) ||
      (e.payerName || '').toLowerCase().includes(q)
    );
  });

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.78)',
        zIndex: 100010,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backdropFilter: 'blur(6px)',
        direction: 'rtl',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.35rem',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
            color: '#fff',
            padding: '0.8rem 1rem',
            borderRadius: '16px',
          }}
        >
          <div>
            <div style={{ fontSize: '0.98rem', fontWeight: 800 }}>
              🔗 שיוך חשבונית להוצאה קיימת
            </div>
            <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '2px' }}>
              ללא הוספה לסה&quot;כ ההוצאות • מציג רק הוצאות ללא חשבונית ({unattachedExpenses.length})
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {receiptQueue && receiptQueue.length > 1 && (
              <span
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                }}
              >
                {queueIdx + 1}/{receiptQueue.length}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scanned Receipt Summary +Editable OCR Fields (Direction 1) */}
        {currentReceipt && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '0.75rem 0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  onClick={() =>
                    setPreviewDoc({
                      id: 'preview-receipt',
                      title: extractedDoc.supplier || 'חשבונית שנסרקה',
                      url: uploadedUrls?.url || localFirstPageThumb || currentReceipt.url,
                      pages: uploadedUrls?.pages || (localFirstPageThumb ? [localFirstPageThumb] : currentReceipt.pages),
                    })
                  }
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1.5px solid #94a3b8',
                    flexShrink: 0,
                    cursor: 'pointer',
                    position: 'relative',
                    background: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.08)',
                  }}
                  title="לחץ להגדלת החשבונית"
                >
                  {(() => {
                    const candidateImg = uploadedUrls?.url || localFirstPageThumb || (currentReceipt.pages && currentReceipt.pages[0]);
                    const isCandidatePdf = !candidateImg || candidateImg.toLowerCase().includes('.pdf') || candidateImg.startsWith('data:application/pdf');

                    if (candidateImg && !isCandidatePdf) {
                      return (
                        <img
                          src={candidateImg}
                          alt="Receipt"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      );
                    }

                    // Fallback to PdfThumbnail component if it's a PDF
                    return (
                      <PdfThumbnail
                        url={currentReceipt.url}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    );
                  })()}
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      right: 2,
                      background: 'rgba(0,0,0,0.7)',
                      color: '#fff',
                      fontSize: '0.62rem',
                      padding: '1px 4px',
                      borderRadius: '4px',
                    }}
                  >
                    🔍
                  </span>
                </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isScanningOcr ? (
                    <>
                      <div style={{ width: '12px', height: '12px', border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      <span style={{ color: '#2563eb' }}>מפענח נתונים מהחשבונית (OCR)...</span>
                    </>
                  ) : (
                    <span>📄 נתוני החשבונית החדשה:</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                  {isScanningOcr ? 'סורק סכום, תאריך ושם ספק באופן אוטומטי...' : 'הנתונים שחולצו מהמסמך שלך (ניתן לערוך ידנית):'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  שם הספק:
                </label>
                <input
                  type="text"
                  placeholder="שם ספק..."
                  value={extractedDoc.supplier || ''}
                  onChange={(e) => setExtractedDoc((p) => ({ ...p, supplier: e.target.value }))}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.55rem 0.65rem',
                    borderRadius: '9px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    background: '#ffffff',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  סכום החשבונית:
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={extractedDoc.amount ?? ''}
                    onChange={(e) =>
                      setExtractedDoc((p) => ({
                        ...p,
                        amount: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.55rem 2rem 0.55rem 0.65rem',
                      borderRadius: '9px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.94rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      background: '#ffffff',
                      textAlign: 'left',
                      direction: 'ltr',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: '0.65rem',
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      color: '#2563eb',
                      pointerEvents: 'none',
                    }}
                  >
                    ₪
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Direction 1: Candidate Expenses List */}
        {currentReceipt && (
          <div style={{ marginTop: '0.4rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
            <div style={{ marginBottom: '0.35rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                📋 שייך להוצאה קיימת במרחב (ללא חשבונית):
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                בחר הוצאה שכבר נרשמה וחסרה לה חשבונית, כדי להצמיד אליה את הקובץ:
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                {expenseMatches.length > 0
                  ? `🎯 נמצאו ${expenseMatches.length} התאמות מומלצות לפי הסכום והספק:`
                  : 'לא נמצאה התאמה אוטומטית מובהקת'}
              </span>
              <button
                type="button"
                onClick={() => setShowAllManual((v) => !v)}
                style={{
                  background: showAllManual ? '#2563eb' : '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: showAllManual ? '#ffffff' : '#1d4ed8',
                  padding: '0.28rem 0.65rem',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <span>{showAllManual ? '🎯 חזור להתאמות מומלצות' : `🔍 בחר ידנית מכל ההוצאות (${unattachedExpenses.length})`}</span>
              </button>
            </div>

            {unattachedExpenses.length === 0 ? (
              <div
                style={{
                  padding: '1.25rem',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px dashed #cbd5e1',
                  textAlign: 'center',
                  fontSize: '0.85rem',
                  color: '#64748b',
                }}
              >
                לכל ההוצאות בפרויקט כבר מצורפת חשבונית! תוכל להוסיף קובץ זה כהוצאה חדשה.
              </div>
            ) : !showAllManual && expenseMatches.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {expenseMatches.map((m) => {
                  const isSel = selectedId === m.item.id;
                  const c = badgeColor(m.level);
                  return (
                    <div
                      key={m.item.id}
                      onClick={() => setSelectedId(m.item.id)}
                      style={{
                        padding: '0.7rem 0.85rem',
                        borderRadius: '12px',
                        border: isSel ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: isSel ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                          {m.item.supplier || 'ללא שם ספק'} • ₪{Number(m.item.amount || 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          שולם ע&quot;י {m.item.payerName || 'שותף'} • {m.item.date}
                        </div>
                      </div>
                      <span
                        style={{
                          background: c.bg,
                          color: c.text,
                          border: `1px solid ${c.border}`,
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        התאמה {m.score}%
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <input
                  type="text"
                  placeholder="חפש הוצאה ללא חשבונית לפי ספק או סכום..."
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                  }}
                />
                <div style={{ maxHeight: '170px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {manualFilteredExpenses.map((exp) => {
                    const isSel = selectedId === exp.id;
                    return (
                      <div
                        key={exp.id}
                        onClick={() => setSelectedId(exp.id)}
                        style={{
                          padding: '0.6rem 0.75rem',
                          borderRadius: '10px',
                          border: isSel ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          background: isSel ? '#eff6ff' : '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.84rem',
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>{exp.supplier || 'ללא ספק'} ({exp.date})</span>
                        <span style={{ fontWeight: 800 }}>₪{Number(exp.amount || 0).toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Direction 2: Target Expense -> Waiting Inbox Items */}
        {targetExpense && (
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.4rem' }}>
              מחפש חשבונית מתאימה במחסן ההמתנה עבור &quot;{targetExpense.supplier}&quot; (₪{Number(targetExpense.amount || 0).toLocaleString()}):
            </div>
            {waitingInboxItems.length === 0 ? (
              <div
                style={{
                  padding: '1rem',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px dashed #cbd5e1',
                  textAlign: 'center',
                  fontSize: '0.84rem',
                  color: '#64748b',
                }}
              >
                אין חשבוניות ממתינות במחסן הפרויקט כרגע.
                {onScanNewForExpense && (
                  <div style={{ marginTop: '0.65rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onScanNewForExpense(targetExpense);
                      }}
                      style={{
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        padding: '0.55rem 1rem',
                        borderRadius: '10px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      📷 צלם או העלה חשבונית מהמכשיר
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '190px', overflowY: 'auto' }}>
                {(inboxMatches.length > 0
                  ? inboxMatches
                  : waitingInboxItems.map((it) => ({ item: it, score: 0, level: 'low' as const, signals: [], amountDiff: null }))
                ).map((m) => {
                  const isSel = selectedId === m.item.id;
                  const c = badgeColor(m.level);
                  const sup = (m.item.ocrData as any)?.vendor || (m.item.ocrData as any)?.supplier || 'חשבונית במחסן';
                  const amt = m.item.ocrData?.amount || '---';
                  return (
                    <div
                      key={m.item.id}
                      onClick={() => setSelectedId(m.item.id)}
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: '12px',
                        border: isSel ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: isSel ? '#eff6ff' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                        <img
                          src={m.item.imageUrl}
                          alt="Inbox"
                          style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{sup}</div>
                          <div style={{ fontSize: '0.76rem', color: '#64748b' }}>סכום שזוהה: ₪{amt}</div>
                        </div>
                      </div>
                      <span
                        style={{
                          background: c.bg,
                          color: c.text,
                          border: `1px solid ${c.border}`,
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                        }}
                      >
                        התאמה {m.score}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Side-by-Side Approval Card (Always shown before attaching) */}
        {activeComparison && (
          <div
            style={{
              background: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              borderRadius: '16px',
              padding: '0.9rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                ⚖️ אימות דו-צדדי לפני צירוף החשבונית:
              </span>
              <span
                style={{
                  ...(() => {
                    const c = badgeColor(activeComparison.level);
                    return { background: c.bg, color: c.text, border: `1px solid ${c.border}` };
                  })(),
                  padding: '2px 9px',
                  borderRadius: '999px',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                }}
              >
                מדד ביטחון: {activeComparison.score}%
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              {/* Side A: Existing Expense */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '0.65rem',
                }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '4px' }}>
                  📝 ההוצאה הקיימת בפרויקט
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b' }}>
                  {activeComparison.expense.supplier || 'ללא ספק'}
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', marginTop: '2px' }}>
                  ₪{Number(activeComparison.expense.amount || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                  תאריך: {activeComparison.expense.date || '---'}
                </div>
              </div>

              {/* Side B: Scanned Invoice */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '0.65rem',
                }}
              >
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '4px' }}>
                  🧾 החשבונית המצורפת
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e293b' }}>
                  {activeComparison.invoiceDoc.supplier || 'לא זוהה ספק'}
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', marginTop: '2px' }}>
                  {activeComparison.invoiceDoc.amount != null
                    ? `₪${Number(activeComparison.invoiceDoc.amount).toLocaleString()}`
                    : 'לא זוהה סכום'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                  תאריך: {activeComparison.invoiceDoc.date || '---'}
                </div>
              </div>
            </div>

            {/* Amount discrepancy offer */}
            {activeComparison.amountDiff != null && activeComparison.invoiceDoc.amount != null && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  padding: '0.55rem 0.7rem',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  color: '#92400e',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={applyAmountUpdate}
                  onChange={(e) => setApplyAmountUpdate(e.target.checked)}
                />
                <span>
                  קיים פער של ₪{Math.abs(activeComparison.amountDiff).toLocaleString()} – עדכן את סכום ההוצאה ל-₪
                  {Number(activeComparison.invoiceDoc.amount).toLocaleString()} לפי החשבונית
                </span>
              </label>
            )}

            {activeComparison.expense.status === 'approved' && (
              <div style={{ fontSize: '0.74rem', color: '#475569' }}>
                ℹ️ הוצאה זו כבר אושרה בעבר. הצירוף ייכנס מיד ויישלח לאישור חוזר של השותפים.
              </div>
            )}
          </div>
        )}

        {/* Footer Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.75rem 0.9rem',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#475569',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            ביטול
          </button>

          {currentReceipt && (
            <button
              type="button"
              onClick={() => {
                if (showAllManual) {
                  setShowAllManual(false);
                } else {
                  setShowAllManual(true);
                }
              }}
              style={{
                padding: '0.75rem 0.9rem',
                borderRadius: '12px',
                border: showAllManual ? '1.5px solid #2563eb' : '1px solid #bfdbfe',
                background: showAllManual ? '#eff6ff' : '#ffffff',
                color: '#1d4ed8',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
              title="בחר ידנית הוצאה קיימת מתוך כל רשימת ההוצאות בפרויקט"
            >
              {showAllManual ? '🎯 התאמות מומלצות' : '🔍 צירוף ידני להוצאה'}
            </button>
          )}

          {currentReceipt && onFallbackToNewExpense && (
            <button
              type="button"
              onClick={() => onFallbackToNewExpense(currentReceipt)}
              style={{
                padding: '0.75rem 0.9rem',
                borderRadius: '12px',
                border: '1px solid #c7d2fe',
                background: '#eef2ff',
                color: '#3730a3',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
              title="צור מהמסמך הזה הוצאה חדשה לחלוטין (אם הוא אינו שייך להוצאה קיימת)"
            >
              ➕ צור כהוצאה חדשה
            </button>
          )}

          <button
            type="button"
            disabled={!activeComparison || isSaving}
            onClick={handleConfirmAttach}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              border: 'none',
              background: !activeComparison || isSaving ? '#94a3b8' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: !activeComparison || isSaving ? 'not-allowed' : 'pointer',
              boxShadow: !activeComparison || isSaving ? 'none' : '0 4px 12px rgba(22, 163, 74, 0.3)',
            }}
          >
            {isSaving ? 'מצרף חשבונית...' : '✅ אשר וצרף להוצאה זו'}
          </button>
        </div>
      </div>

      {previewDoc && (
        <UniversalViewerModal
          docs={[previewDoc]}
          initialIndex={0}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>,
    document.body
  );
}

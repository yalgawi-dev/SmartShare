import React, { useState } from 'react';

interface FinanceTransactionsProps {
  invoices: any[];
  filteredInvoices: any[];
  activePartnersCount: number;
  user: any;
  space?: any;
  updateInvoice?: (spaceId: string, invoiceId: string, updates: any, performedBy?: string, actionDetail?: string) => void;
  filter: string;
  setFilter: (filter: string) => void;
  expandedInvoiceId: string | null;
  setExpandedInvoiceId: (id: string | null) => void;
  setPreviewImage: (url: string | null) => void;
}

export function FinanceTransactions({
  invoices,
  filteredInvoices,
  activePartnersCount,
  user,
  space,
  updateInvoice,
  filter,
  setFilter,
  expandedInvoiceId,
  setExpandedInvoiceId,
  setPreviewImage
}: FinanceTransactionsProps) {

  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [editForm, setEditForm] = useState({ amount: '', supplier: '', date: '' });

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice || !space || !updateInvoice) return;
    
    updateInvoice(
      space.id, 
      editingInvoice.id, 
      { 
        amount: Number(editForm.amount), 
        supplier: editForm.supplier,
        date: editForm.date
      },
      user?.id || 'me',
      `שונה סכום ל-${editForm.amount}, ספק: ${editForm.supplier}, תאריך: ${editForm.date}`
    );
    setEditingInvoice(null);
  };

  const handleApprove = (inv: any) => {
    if (!space || !updateInvoice) return;
    const currentApprovedBy = inv.approvedBy || [];
    if (user?.id && !currentApprovedBy.includes(user.id)) {
      const newApprovedBy = [...currentApprovedBy, user.id];
      const newApprovalsReceived = (inv.approvalsReceived || 0) + 1;
      const newStatus = newApprovalsReceived >= inv.approvalsNeeded ? 'approved' : 'pending';
      updateInvoice(space.id, inv.id, {
        approvalsReceived: newApprovalsReceived,
        approvedBy: newApprovedBy,
        status: newStatus
      });
    }
  };

  const calculateCanApprove = (inv: any) => {
    if (inv.status !== 'pending') return false;
    if (inv.type === 'transfer') {
      return inv.targetId === user?.id || inv.targetId === 'me';
    }
    return (inv.payerId !== user?.id && inv.payerId !== 'me' && !(inv.approvedBy || []).includes(user?.id));
  };

  return (
    <div>
      {/* Filter Pills */}
      {(() => {
        const hasArchive = invoices.some((i: any) => i.isActive === false);
        const hasPendingMe = activePartnersCount > 0 || invoices.some((i: any) => i.status === "pending" && i.payerId !== user?.id && i.payerId !== "me");
        const hasPendingPartners = activePartnersCount > 0 || invoices.some((i: any) => i.status === "pending" && (i.payerId === user?.id || i.payerId === "me"));
        
        if (!hasArchive && !hasPendingMe && !hasPendingPartners) return null;

        return (
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", overflowX: "auto", paddingBottom: "0.5rem", scrollbarWidth: "none" }}>
            <button onClick={() => setFilter("all")} style={{ padding: "0.4rem 1rem", borderRadius: "var(--radius-full)", border: "1px solid var(--border-light)", background: filter === "all" || filter === "archive" ? "transparent" : "var(--bg-hover)", fontWeight: filter === "all" ? "bold" : "normal", cursor: "pointer", whiteSpace: "nowrap", background: filter === "all" ? "var(--bg-hover)" : "transparent" }}>
              הוצאות פעילות
            </button>
            {hasArchive && (
              <button onClick={() => setFilter("archive")} style={{ padding: "0.4rem 1rem", borderRadius: "var(--radius-full)", border: "1px solid var(--border-light)", background: filter === "archive" ? "var(--bg-hover)" : "transparent", fontWeight: filter === "archive" ? "bold" : "normal", cursor: "pointer", whiteSpace: "nowrap" }}>
                ארכיון מחוקים
              </button>
            )}
            {hasPendingMe && (
              <button onClick={() => setFilter("pending_me")} style={{ padding: "0.4rem 1rem", borderRadius: "var(--radius-full)", border: "1px solid var(--border-light)", background: filter === "pending_me" ? "var(--bg-hover)" : "transparent", fontWeight: filter === "pending_me" ? "bold" : "normal", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", whiteSpace: "nowrap" }}>
                ממתינים לאישורי
                {invoices.filter((i: any) => i.status === "pending" && i.payerId !== user?.id && i.payerId !== "me").length > 0 && (
                  <span style={{ background: "#f59e0b", color: "white", borderRadius: "50%", width: "18px", height: "18px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem" }}>
                    {invoices.filter((i: any) => i.status === "pending" && i.payerId !== user?.id && i.payerId !== "me").length}
                  </span>
                )}
              </button>
            )}
            {hasPendingPartners && (
              <button onClick={() => setFilter("pending_partners")} style={{ padding: "0.4rem 1rem", borderRadius: "var(--radius-full)", border: "1px solid var(--border-light)", background: filter === "pending_partners" ? "var(--bg-hover)" : "transparent", fontWeight: filter === "pending_partners" ? "bold" : "normal", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", whiteSpace: "nowrap" }}>
                ממתין לאישור השותפים
              </button>
            )}
          </div>
        );
      })()}
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
                    {inv.status === 'approved' ? '✓' : inv.status === 'pending' ? '⏳' : '❌'}
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
                          {inv.status === 'approved' ? (
                            <span style={{ color: '#10b981', fontSize: '0.9rem' }}>✓ מאושר.</span>
                          ) : inv.status === 'dispute' ? (
                            <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>❌ נדחה / במחלוקת.</span>
                          ) : (
                            <span style={{ color: '#f59e0b', fontSize: '0.9rem' }}>⏳ ממתין לאישור ({inv.approvalsReceived} מתוך {inv.approvalsNeeded}).</span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                        {calculateCanApprove(inv) && (
                          <button onClick={() => handleApprove(inv)} style={{ flex: 1, padding: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                            ✅ {inv.type === 'transfer' ? 'אשר קבלת תשלום' : 'אשר הוצאה זו'}
                          </button>
                        )}
                        {calculateCanApprove(inv) && inv.type === 'transfer' && activePartnersCount > 0 && (
                          <button onClick={() => updateInvoice && space && updateInvoice(space.id, inv.id, { status: 'dispute' })} style={{ flex: 1, padding: '0.75rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                            פתח מחלוקת
                          </button>
                        )}
                        {(inv.payerId === user?.id || inv.payerId === 'me') && inv.status === 'pending' && activePartnersCount > 0 && (
                          <button onClick={() => alert('נשלח פוש ותזכורת לשותפים!')} style={{ flex: 1, padding: '0.75rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                            שלח נדנוד לאישור
                          </button>
                        )}
                        {(inv.payerId === user?.id || inv.payerId === 'me') && (
                          <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                            <button onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (editingInvoice?.id === inv.id) {
                                setEditingInvoice(null);
                              } else {
                                setEditingInvoice(inv);
                                // Format date to YYYY-MM-DD for the input
                                let d = inv.date || '';
                                if (d.includes('.')) {
                                  const parts = d.split('.');
                                  if (parts.length === 3) d = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                                } else if (d.includes('/')) {
                                  const parts = d.split('/');
                                  if (parts.length === 3) d = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                                }
                                setEditForm({ amount: inv.amount || '', supplier: inv.supplier || '', date: d });
                              }
                            }} style={{ flex: 1, padding: '0.75rem', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                              ✏️ {editingInvoice?.id === inv.id ? 'סגור עריכה' : 'ערוך'}
                            </button>
                            <button onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (window.confirm('האם אתה בטוח שברצונך למחוק הוצאה זו?')) {
                                if (updateInvoice && space) {
                                  updateInvoice(space.id, inv.id, { isActive: false }, user?.id || 'me', 'מחיקת חשבונית');
                                } else {
                                  alert('שגיאה בתקשורת עם השרת');
                                }
                              }
                            }} style={{ flex: 1, padding: '0.75rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                              🗑️ מחק
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Edit Form Modal */}
                    {editingInvoice?.id === inv.id && (
                      <div style={{ padding: '1rem', borderTop: '1px solid var(--border-light)', background: 'var(--bg-main)', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                        <form onSubmit={handleEditSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <h4 style={{ margin: '0 0 0.5rem 0' }}>עריכת הוצאה</h4>
                          
                          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            תאריך ההוצאה
                            <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '1rem' }} required />
                          </label>

                          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            ספק / שם החנות
                            <input type="text" placeholder="לדוגמה: שופרסל" value={editForm.supplier} onChange={e => setEditForm({...editForm, supplier: e.target.value})} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '1rem' }} required />
                          </label>

                          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            סכום (₪)
                            <input type="number" placeholder="0.00" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '1rem' }} required />
                          </label>

                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button type="button" onClick={() => setEditingInvoice(null)} style={{ flex: 1, padding: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '8px', cursor: 'pointer' }}>ביטול</button>
                            <button type="submit" style={{ flex: 1, padding: '0.5rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>שמור שינויים</button>
                          </div>
                        </form>
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

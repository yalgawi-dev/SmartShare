const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceTransactions.tsx", "utf-8");

const newTabs = `      {(() => {
        const hasArchive = invoices.some((i: any) => i.isActive === false);
        const hasPendingMe = activePartnersCount > 0 || invoices.some((i: any) => i.status === "pending" && i.payerId !== user?.id && i.payerId !== "me");
        const hasPendingPartners = activePartnersCount > 0 || invoices.some((i: any) => i.status === "pending" && (i.payerId === user?.id || i.payerId === "me"));
        
        if (!hasArchive && !hasPendingMe && !hasPendingPartners) return null;

        return (
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", overflowX: "auto", paddingBottom: "0.5rem", scrollbarWidth: "none" }}>
            <button onClick={() => setFilter("all")} style={{ padding: "0.4rem 1rem", borderRadius: "var(--radius-full)", border: "1px solid var(--border-light)", background: filter === "all" || filter === "archive" ? "transparent" : "var(--bg-hover)", fontWeight: filter === "all" ? "bold" : "normal", cursor: "pointer", whiteSpace: "nowrap", background: filter === "all" ? "var(--bg-hover)" : "transparent" }}>
              הכל
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

      {filteredInvoices.length === 0 ? (`;

const s3 = content.indexOf("      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem'");
const endIdx = content.indexOf("      {filteredInvoices.length === 0 ? (");

if (s3 !== -1 && endIdx !== -1) {
  content = content.substring(0, s3) + newTabs + content.substring(endIdx + 41);
} else {
  console.log("Could not find tabs section", s3, endIdx);
}

const actionButtonsStart = `                        {(inv.payerId === user?.id || inv.payerId === 'me') && (`;
const actionButtonsEnd = `                        )}
                      </div>
                    </div>`;

const newActionButtons = `                        {(inv.payerId === user?.id || inv.payerId === 'me') && (
                          <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                            {inv.isActive === false ? (
                              <button onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (window.confirm("לשחזר את ההוצאה מהארכיון?")) {
                                  if (updateInvoice && space) {
                                    updateInvoice(space.id, inv.id, { isActive: true }, user?.id || "me", "שחזור מחיקה");
                                  }
                                }
                              }} style={{ flex: 1, padding: "0.75rem", background: "#d1fae5", color: "#065f46", border: "none", borderRadius: "12px", fontWeight: "bold", cursor: "pointer" }}>
                                ♻️ שחזר
                              </button>
                            ) : (
                              <>
                                <button onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (editingInvoice?.id === inv.id) {
                                    setEditingInvoice(null);
                                  } else {
                                    setEditingInvoice(inv);
                                    let d = inv.date || '';
                                    if (d.includes('.')) {
                                      const parts = d.split('.');
                                      if (parts.length === 3) d = \`\${parts[2]}-\${parts[1].padStart(2, '0')}-\${parts[0].padStart(2, '0')}\`;
                                    } else if (d.includes('/')) {
                                      const parts = d.split('/');
                                      if (parts.length === 3) d = \`\${parts[2]}-\${parts[1].padStart(2, '0')}-\${parts[0].padStart(2, '0')}\`;
                                    }
                                    setEditForm({ amount: inv.amount || '', supplier: inv.supplier || '', date: d });
                                  }
                                }} style={{ flex: 1, padding: '0.75rem', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                                  ✏️ {editingInvoice?.id === inv.id ? 'סגור עריכה' : 'ערוך'}
                                </button>
                                <button onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (window.confirm("האם אתה בטוח שברצונך למחוק הוצאה זו?")) {
                                    if (updateInvoice && space) {
                                      updateInvoice(space.id, inv.id, { isActive: false }, user?.id || "me", "מחיקת חשבונית");
                                    } else {
                                      alert("שגיאה בתקשורת עם השרת");
                                    }
                                  }
                                }} style={{ flex: 1, padding: '0.75rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                                  🗑️ מחק
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>`;

const abStartIdx = content.indexOf(actionButtonsStart);
const abEndIdx = content.indexOf(actionButtonsEnd, abStartIdx);
if (abStartIdx !== -1 && abEndIdx !== -1) {
  content = content.substring(0, abStartIdx) + newActionButtons + content.substring(abEndIdx + actionButtonsEnd.length);
} else {
  console.log("Could not find action buttons section");
}

fs.writeFileSync("src/components/widgets/Finance/FinanceTransactions.tsx", content, "utf-8");
console.log("done ui fixes");

const fs = require("fs");
let lines = fs.readFileSync("src/components/widgets/Finance/FinanceTransactions.tsx", "utf-8").split("\n");

// 1. Fix tabs
let tabsStartIndex = lines.findIndex(l => l.includes("<div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem'"));
let tabsEndIndex = lines.findIndex(l => l.includes("{filteredInvoices.length === 0 ? ("));

if (tabsStartIndex !== -1 && tabsEndIndex !== -1) {
  const newTabs = `      {(() => {
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
      })()}`;
      
  lines.splice(tabsStartIndex, tabsEndIndex - tabsStartIndex, newTabs);
} else {
    console.log("Could not find tabs section", tabsStartIndex, tabsEndIndex);
}

// 2. Fix the action buttons inside {(inv.payerId === user?.id || inv.payerId === 'me') && (
let content = lines.join("\n");

const targetButtonsStart = `                        {(inv.payerId === user?.id || inv.payerId === 'me') && (
                          <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                            <button onClick={(e) => {`;

const newButtons = `                        {(inv.payerId === user?.id || inv.payerId === 'me') && (
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
                                ♻️ שחזר הוצאה
                              </button>
                            ) : (
                              <>
                                <button onClick={(e) => {`;

content = content.replace(targetButtonsStart, newButtons);

const targetButtonsMiddle = `                            </button>
                            <button onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (window.confirm('האם אתה בטוח שברצונך למחוק הוצאה זו?')) {`;

const newButtonsMiddle = `                            </button>
                                <button onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (window.confirm('האם אתה בטוח שברצונך למחוק הוצאה זו?')) {`;

content = content.replace(targetButtonsMiddle, newButtonsMiddle);

const targetButtonsEnd = `                            </button>
                          </div>
                        )}
                      </div>`;

const newButtonsEnd = `                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>`;

content = content.replace(targetButtonsEnd, newButtonsEnd);

fs.writeFileSync("src/components/widgets/Finance/FinanceTransactions.tsx", content, "utf-8");
console.log("Finance rewritten!");


const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceTransactions.tsx", "utf-8");
const target = `<button onClick={() => setFilter("all")}`;
const replacement = `<button onClick={() => setFilter("archive")} style={{ padding: "0.4rem 1rem", borderRadius: "var(--radius-full)", border: "1px solid var(--border-light)", background: filter === "archive" ? "var(--bg-hover)" : "transparent", fontWeight: filter === "archive" ? "bold" : "normal", cursor: "pointer", whiteSpace: "nowrap" }}>
          ארכיון מחוקים
        </button>\n        <button onClick={() => setFilter("all")}`;
content = content.replace(target, replacement);

const deleteButton = `                            <button onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (window.confirm("האם אתה בטוח שברצונך למחוק הוצאה זו?")) {
                                if (updateInvoice && space) {
                                  updateInvoice(space.id, inv.id, { isActive: false }, user?.id || "me", "מחיקת חשבונית");
                                } else {
                                  alert("שגיאה בתקשורת עם השרת");
                                }
                              }
                            }} style={{ flex: 1, padding: "0.75rem", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "12px", fontWeight: "bold", cursor: "pointer" }}>
                              🗑️ מחק
                            </button>`;

const enhancedButtons = `                            {inv.isActive === false ? (
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
                            }} style={{ flex: 1, padding: "0.75rem", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "12px", fontWeight: "bold", cursor: "pointer" }}>
                              🗑️ מחק
                            </button>
                            )}`;

content = content.replace(deleteButton, enhancedButtons);
fs.writeFileSync("src/components/widgets/Finance/FinanceTransactions.tsx", content, "utf-8");


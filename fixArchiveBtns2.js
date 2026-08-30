const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceTransactions.tsx", "utf-8");

// Fallback replacement logic
const startKey = "{(inv.payerId === user?.id || inv.payerId === 'me') && (";
const startIdx = content.indexOf(startKey);
if(startIdx !== -1) {
    const endKey = ")}";
    // find the 3rd )} after startIdx because there are inner braces? 
    // actually just find the next <!-- Edit Form Modal --> and back up
    const editFormIdx = content.indexOf("{/* Edit Form Modal */}", startIdx);
    if(editFormIdx !== -1) {
        // the block ends right before the div closing the right side, so back up from editFormIdx
        const blockEnd = content.lastIndexOf(")}", editFormIdx) + 2; 
        // Wait, let's just find "🗑️ ביטול" or "🗑️ " or "ביטול"
        const trashIdx = content.indexOf("🗑️", startIdx);
        if (trashIdx !== -1) {
            const buttonClose = content.indexOf("</button>", trashIdx) + 9;
            const divClose = content.indexOf("</div>", buttonClose) + 6;
            const blockClose = content.indexOf(")}", divClose) + 2;
            
            const newBlock = `{(inv.payerId === user?.id || inv.payerId === 'me') && (
                          <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                            {inv.isActive === false ? (
                              <button onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (updateInvoice && space) {
                                  const details = \`שחזר/ה את ההוצאה מול הספק '\${inv.supplier}' על סך ₪\${inv.amount?.toLocaleString()}\`;
                                  updateInvoice(space.id, inv.id, { isActive: true }, user?.realName || user?.id || 'me', details);
                                }
                              }} style={{ flex: 1, padding: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                                ↩️ שחזור הוצאה מבוטלת
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
                                  ✏️ {editingInvoice?.id === inv.id ? 'סגור עריכה' : 'עריכה'}
                                </button>
                                <button onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (window.confirm('האם אתה בטוח שברצונך לבטל הוצאה זו? היא תעבור לארכיון.')) {
                                    if (updateInvoice && space) {
                                      const details = \`ביטל/ה את ההוצאה מול ספק '\${inv.supplier}' על סך ₪\${inv.amount?.toLocaleString()} והעביר/ה לארכיון\`;
                                      updateInvoice(space.id, inv.id, { isActive: false }, user?.realName || user?.id || 'me', details);
                                    } else {
                                      alert('שגיאה. נסה שוב מאוחר יותר');
                                    }
                                  }
                                }} style={{ flex: 1, padding: '0.75rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                                  🗑️ מחיקה לארכיון
                                </button>
                              </>
                            )}
                          </div>
                        )}`;
                        
            content = content.substring(0, startIdx) + newBlock + content.substring(blockClose);
            fs.writeFileSync("src/components/widgets/Finance/FinanceTransactions.tsx", content, "utf-8");
            console.log("Replaced using dynamic ending index!");
        } else {
            console.log("Could not find trash emoji.");
        }
    }
}

const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceTransactions.tsx", "utf-8");

const oldBlock = `{(inv.payerId === user?.id || inv.payerId === 'me') && (
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
                              if (window.confirm('האם אתה בטוח שברצונך לבטל הוצאה זו?')) {
                                if (updateInvoice && space) {
                                  updateInvoice(space.id, inv.id, { isActive: false }, user?.realName || user?.id || 'me', 'ביטל/ה את ההוצאה לצמיתות');
                                } else {
                                  alert('שגיאה. נסה שוב מאוחר יותר');
                                }
                              }
                            }} style={{ flex: 1, padding: '0.75rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                              🗑️ ביטול
                            </button>
                          </div>
                        )}`;

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

if (content.includes("{(inv.payerId === user?.id || inv.payerId === 'me') && (")) {
    const startIdx = content.indexOf("{(inv.payerId === user?.id || inv.payerId === 'me') && (");
    // To ensure exact match with different spacing, let's use a regex or string extraction
    const endStr = `🗑️ ביטול\n                            </button>\n                          </div>\n                        )}`;
    const endIdx = content.indexOf(endStr);
    
    if (endIdx !== -1) {
        content = content.substring(0, startIdx) + newBlock + content.substring(endIdx + endStr.length);
        fs.writeFileSync("src/components/widgets/Finance/FinanceTransactions.tsx", content, "utf-8");
        console.log("FinanceTransactions replaced successfully!");
    } else {
        console.log("Could not find exact end string!");
    }
} else {
    console.log("Could not find start string.");
}

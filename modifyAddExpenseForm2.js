const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceAddExpenseForm.tsx", "utf-8");

const toggleUI = `
          {/* Credit Invoice Toggle */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-lg)', padding: '0.4rem', marginBottom: '1.5rem', border: '1px solid var(--border-light)' }}>
            <button
              type="button"
              onClick={() => setIsCredit(false)}
              style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-md)', border: 'none', background: !isCredit ? 'white' : 'transparent', color: !isCredit ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 'bold', boxShadow: !isCredit ? '0 2px 8px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              חשבונית / קבלה
            </button>
            <button
              type="button"
              onClick={() => setIsCredit(true)}
              style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-md)', border: 'none', background: isCredit ? '#fef2f2' : 'transparent', color: isCredit ? '#ef4444' : 'var(--text-secondary)', fontWeight: 'bold', boxShadow: isCredit ? '0 2px 8px rgba(239,68,68,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              חשבונית זיכוי
            </button>
          </div>

          {/* Store Credit Question (Only if Credit) */}
          {isCredit && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
              <p style={{ margin: '0 0 0.75rem 0', fontWeight: 'bold', color: '#991b1b', fontSize: '0.95rem' }}>האם הכסף הוחזר אליך לחשבון / אשראי?</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsStoreCredit(false)}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-md)', border: !isStoreCredit ? '2px solid #ef4444' : '1px solid #fca5a5', background: !isStoreCredit ? '#ef4444' : 'white', color: !isStoreCredit ? 'white' : '#ef4444', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  כן, קיבלתי זיכוי
                </button>
                <button
                  type="button"
                  onClick={() => setIsStoreCredit(true)}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-md)', border: isStoreCredit ? '2px solid #ef4444' : '1px solid #fca5a5', background: isStoreCredit ? '#ef4444' : 'white', color: isStoreCredit ? 'white' : '#ef4444', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  לא, נשאר בחנות
                </button>
              </div>
              {isStoreCredit && <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.8rem', color: '#b91c1c' }}>הזיכוי יקוזז מסך הוצאות הפרויקט, אך לא יפגע בהתחשבנות שלך (כיוון ששילמת מכספך).</p>}
            </div>
          )}
          
          <input type="hidden" name="isCredit" value={isCredit ? 'true' : 'false'} />
          <input type="hidden" name="isStoreCredit" value={isStoreCredit ? 'true' : 'false'} />
`;

content = content.replace(
  /<form key=\{[^\}]+\} onSubmit=\{handleAddExpense\} style=\{\{[^\}]+\}\}>/,
  (match) => match + "\n" + toggleUI
);

fs.writeFileSync("src/components/widgets/Finance/FinanceAddExpenseForm.tsx", content, "utf-8");
console.log("Updated FinanceAddExpenseForm.tsx with toggle");

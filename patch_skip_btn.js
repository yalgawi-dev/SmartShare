const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', 'utf8');
const searchStr = '<button type="submit"';
const injection = `{ocrData?._duplicateWarning && (
              <button type="button" onClick={() => handleCloseForm()} style={{ width: '100%', marginBottom: '1rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #f87171', padding: '1rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', transition: 'all 0.2s ease' }}>
                דלג על חשבונית זו (כפילות)
              </button>
            )}
            <button type="submit"`;
content = content.replace(searchStr, injection);
fs.writeFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', content);

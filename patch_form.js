const fs = require('fs');
let form = fs.readFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', 'utf8');

const strToAdd = `<form key={JSON.stringify(ocrData) + (scannedImage || 'new-expense')} onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '100%' }}>
          
          {retroInvoiceToEdit && ocrData?.amount && Number(retroInvoiceToEdit.amount) > 0 && Math.abs(Number(retroInvoiceToEdit.amount) - Number(ocrData.amount)) >= 1 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', padding: '1rem', borderRadius: '8px', color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
              <div>
                <strong>שים לב לפער בסכום!</strong>
                <br/>
                הסכום המקורי שהקלדת היה ₪{retroInvoiceToEdit.amount}, אך מערכת ה-AI זיהתה בסריקה ₪{ocrData.amount}. 
                <br/>
                הסכום בטופס עודכן ל-₪{ocrData.amount}, אנא ודא שהסכום נכון לפני השמירה.
              </div>
            </div>
          )}
`;

form = form.replace(`<form key={JSON.stringify(ocrData) + (scannedImage || 'new-expense')} onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '100%' }}>`, strToAdd);

fs.writeFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', form);

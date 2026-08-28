const fs = require('fs');

let route = fs.readFileSync('src/app/api/ocr/route.ts', 'utf8');
route = route.replace(
    /const \{ imageUrl \} = await request\.json\(\);/,
    'const { imageUrl, vatRate = 17 } = await request.json();'
);
route = route.replace(
    /- "vatAmount": The VAT amount extracted as a number.*/,
    '- "vatAmount": The VAT amount extracted as a number. If not written explicitly, calculate it from the total assuming ${vatRate}% standard rate if it says includes VAT. If unsure, leave null.\n        - "documentType": Look for words indicating the document type: "מקור" (Original), "העתק" (Copy), or "נאמן למקור" (Certified True Copy). Return exactly one of these three Hebrew strings, or null if you cannot find any indication.'
);
route = route.replace(
    /vatAmount: \{ type: "NUMBER", description: "The VAT amount" \},/,
    'vatAmount: { type: "NUMBER", description: "The VAT amount" },\n              documentType: { type: "STRING", description: "The type of document: מקור, העתק, or נאמן למקור" },'
);
fs.writeFileSync('src/app/api/ocr/route.ts', route, 'utf8');

let spaces = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf8');
spaces = spaces.replace(
    /vatNumber\?: string;/,
    'vatNumber?: string;\n    documentType?: string;'
);
fs.writeFileSync('src/app/context/SpacesContext.tsx', spaces, 'utf8');

let widget = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf8');
widget = widget.replace(
    /const invoiceNumber = \(formData\.get\('invoiceNumber'\) as string\) \|\| '';/,
    "const invoiceNumber = (formData.get('invoiceNumber') as string) || '';\n      const documentType = (formData.get('documentType') as string) || null;"
);
widget = widget.replace(
    /invoiceNumber,/,
    'invoiceNumber,\n        documentType,'
);
widget = widget.replace(/v17\.9\.56 Smart UX/, 'v17.9.61 Fix');
fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', widget, 'utf8');

let form = fs.readFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', 'utf8');
form = form.replace(
    /\{ocrDebugMessage && \([\s\S]*?<\/div>\s*\)\}/,
    `{ocrDebugMessage && (
            <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '12px', border: '1px solid #f87171', fontSize: '0.9rem', whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left' }}>
              {ocrDebugMessage}
            </div>
          )}

          {ocrData?.documentType && (
            <div style={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', gap: '0.5rem', background: '#eef2ff', color: '#4f46e5', padding: '0.5rem 1rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid #c7d2fe' }}>
              📄 סוג מסמך (AI): {ocrData.documentType}
              <input type="hidden" name="documentType" value={ocrData.documentType} />
            </div>
          )}`
);

form = form.replace(/✨ תואם למקור/g, '✨ חולץ ע״י AI');

form = form.replace(
    /\{activePartnersCount > 0 && \(\s*<div style=\{\{ display: 'flex', flexDirection: 'column', gap: '0.5rem' \}\}>\s*<select/g,
    `{activePartnersCount > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>מי שילם?</label>
              <select`
);

form = form.replace(
    /<div style=\{\{ display: 'flex', flexDirection: 'column', gap: '0.5rem' \}\}>\s*<select\s*required\s*value=\{selectedCategory\}/g,
    `<div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>קטגוריית הוצאה</label>
            <select 
              required 
              value={selectedCategory}`
);

fs.writeFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', form, 'utf8');

const fs = require('fs');

function b(str) { return Buffer.from(str, 'base64').toString('utf8'); }

// 1. route.ts fixes
let routeContent = fs.readFileSync('src/app/api/ocr/route.ts', 'utf8');

routeContent = routeContent.replace(
    'const { imageUrl } = await request.json();',
    'const { imageUrl, vatRate = 17 } = await request.json();'
);

routeContent = routeContent.replace(
    '        - "amount": Total amount to pay as a number (' + b('0YHQlSLbtCDXnNeq16nXnNeV150gLyDXpNeb15XXnSDXm9eV15zXmSDXnteiImM=') + ').\n          - "vatAmount": The VAT amount extracted as a number. If not written explicitly, calculate it from the total assuming % standard rate if it says includes VAT. If unsure, leave null.\n        - "date": Date of invoice in YYYY-MM-DD format.',
    '        - "amount": Total amount to pay as a number (' + b('0YHQlSLbtCDXnNeq16nXnNeV150gLyDXpNeb15XXnSDXm9eV15zXmSDXnteiImM=') + ').\n        - "vatAmount": The VAT amount extracted as a number. If not written explicitly, calculate it from the total assuming % standard rate if it says includes VAT. If unsure, leave null.\n        - "documentType": Look for words indicating the document type: "' + b('157Xpdec15k=') + '" (Original), "' + b('15bXnteq16c=') + '" (Copy), or "' + b('16DXntefINec157Xpdec15k=') + '" (Certified True Copy). Return exactly one of these three Hebrew strings, or null if you cannot find any indication.\n        - "date": Date of invoice in YYYY-MM-DD format.'
);

routeContent = routeContent.replace(
    'vatAmount: { type: "NUMBER", description: "The VAT amount" },\n              date: { type: "STRING", description: "Date of invoice in YYYY-MM-DD format" },',
    'vatAmount: { type: "NUMBER", description: "The VAT amount" },\n              documentType: { type: "STRING", description: "The type of document: ' + b('157Xpdec15ksINeW157XqtenLCBvciDXoNee158g15zXntee16XXmQ==') + '" },\n              date: { type: "STRING", description: "Date of invoice in YYYY-MM-DD format" },'
);
fs.writeFileSync('src/app/api/ocr/route.ts', routeContent, 'utf8');


// 2. SpacesContext.tsx
let spacesContent = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf8');
spacesContent = spacesContent.replace(
    'vatNumber?: string;\n}',
    'vatNumber?: string;\n    documentType?: string;\n}'
);
fs.writeFileSync('src/app/context/SpacesContext.tsx', spacesContent, 'utf8');


// 3. FinanceWidget.tsx
let widgetContent = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf8');
widgetContent = widgetContent.replace(
    /const invoiceNumber = \(formData.get\('invoiceNumber'\) as string\) \|\| '';/,
    "const invoiceNumber = (formData.get('invoiceNumber') as string) || '';\n      const documentType = (formData.get('documentType') as string) || null;"
);
widgetContent = widgetContent.replace(
    'invoiceNumber,\n      approvalsNeeded',
    'invoiceNumber,\n      documentType,\n      approvalsNeeded'
);
widgetContent = widgetContent.replace('v17.9.56 Smart UX', 'v17.9.61 Fix');
fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', widgetContent, 'utf8');


// 4. FinanceAddExpenseForm.tsx
let formContent = fs.readFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', 'utf8');

formContent = formContent.replace(
    '{ocrDebugMessage && (\n            <div style={{ padding: "1rem", background: "#fee2e2", color: "#991b1b", borderRadius: "12px", border: "1px solid #f87171", fontSize: "0.9rem", whiteSpace: "pre-wrap", direction: "ltr", textAlign: "left" }}>\n              {ocrDebugMessage}\n            </div>\n          )}'.replace(/"/g, "'"),
    '{ocrDebugMessage && (\n            <div style={{ padding: "1rem", background: "#fee2e2", color: "#991b1b", borderRadius: "12px", border: "1px solid #f87171", fontSize: "0.9rem", whiteSpace: "pre-wrap", direction: "ltr", textAlign: "left" }}>\n              {ocrDebugMessage}\n            </div>\n          )}\n\n          {ocrData?.documentType && (\n            <div style={{ display: "inline-flex", alignItems: "center", alignSelf: "flex-start", gap: "0.5rem", background: "#eef2ff", color: "#4f46e5", padding: "0.5rem 1rem", borderRadius: "999px", fontSize: "0.85rem", fontWeight: "bold", border: "1px solid #c7d2fe" }}>\n              ?? '.replace(/"/g, "'") + b('16HXldeSINee16HXntea') + ' (AI): {ocrData.documentType}\n              <input type="hidden" name="documentType" value={ocrData.documentType} />\n            </div>\n          )}'
);

formContent = formContent.replace(new RegExp(b('4pyoINeq15XXkdefINec157Xpdec15k='), 'g'), b('4pyoINeX15XXnNeiINei16TXmSBBSQ=='));

formContent = formContent.replace(
    '{activePartnersCount > 0 && (\n            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>\n              <select'.replace(/"/g, "'"),
    '{activePartnersCount > 0 && (\n            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>\n              <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "bold" }}>'.replace(/"/g, "'") + b('157XmSDXqdec150/') + '</label>\n              <select'
);

formContent = formContent.replace(
    '<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>\n            <select \n              required \n              value={selectedCategory}'.replace(/"/g, "'"),
    '<div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>\n            <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "bold" }}>'.replace(/"/g, "'") + b('16fXm9eY15LXl9eo15nXm9eqINeU15XXpteQ15Q=') + '</label>\n            <select \n              required \n              value={selectedCategory}'
);

fs.writeFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', formContent, 'utf8');

const fs = require('fs');
let widget = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf8');

// Strip all of them out
widget = widget.replace(/const documentType = \(formData\.get\('documentType'\) as string\) \|\| null;\s*/g, '');

// Put exactly one back
widget = widget.replace(
    /const invoiceNumber = \(formData\.get\('invoiceNumber'\) as string\) \|\| '';/,
    "const invoiceNumber = (formData.get('invoiceNumber') as string) || '';\n    const documentType = (formData.get('documentType') as string) || null;"
);

// Fix the other injection (addInvoice payload)
// Let's just remove all documentType, and add exactly one
widget = widget.replace(/documentType,\s*/g, '');
widget = widget.replace(
    /invoiceNumber,/,
    'invoiceNumber,\n      documentType,'
);

fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', widget, 'utf8');

const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceAddExpenseForm.tsx", "utf-8");

// 1. Update formValues initial state
content = content.replace(
  "supplier: ocrData?.vendor || '',",
  "supplier: ocrData?.vendor || '',\n      clientName: ocrData?.clientName || '',"
);

// 2. Update formValues in useEffect
content = content.replace(
  "supplier: ocrData.vendor || '',",
  "supplier: ocrData.vendor || '',\n          clientName: ocrData.clientName || '',"
);

// 3. Render the clientName input next to supplier
const supplierInputHtml = `{renderSmartInput('supplier', 'text', 'שם העסק / הספק', 'שם העסק / הספק', formValues.supplier, !!ocrData.vendor, true)}`;
// Wait, in powershell it's garbled, let's use a dynamic search string:
const supplierSearch = /\{renderSmartInput\('supplier'[^}]+\)\}/;

content = content.replace(supplierSearch, (match) => {
  return `${match}
                {renderSmartInput('clientName', 'text', 'מקבל השירות (לכבוד)', 'מקבל השירות', formValues.clientName, !!ocrData.clientName, false)}`;
});

fs.writeFileSync("src/components/widgets/Finance/FinanceAddExpenseForm.tsx", content, "utf-8");
console.log("Updated FinanceAddExpenseForm.tsx for clientName");

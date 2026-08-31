const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/FinanceWidget.tsx", "utf-8");

// 1. Update ocrData type
content = content.replace(
  "vendor?: string, vatNumber?: string",
  "vendor?: string, clientName?: string, vatNumber?: string"
);

// 2. Extract clientName in handleAddExpense
content = content.replace(
  "const supplier = formData.get('supplier') as string;",
  "const supplier = formData.get('supplier') as string;\n    const clientName = formData.get('clientName') as string;"
);

// 3. Add to newInvoice
const newInvoiceRegex = /const newInvoice:\s*any\s*=\s*\{[\s\S]*?supplier,\s*category,/m;
content = content.replace(newInvoiceRegex, (match) => {
  return match.replace("supplier,", "supplier,\n        clientName,");
});

fs.writeFileSync("src/components/widgets/FinanceWidget.tsx", content, "utf-8");
console.log("Safely updated FinanceWidget.tsx for clientName");

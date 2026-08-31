const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/FinanceWidget.tsx", "utf-8");

// 1. Update ocrData type
content = content.replace(
  "vendor?: string, vatNumber?: string",
  "vendor?: string, clientName?: string, vatNumber?: string"
);

// 2. Extract clientName in handleAddExpense
const extractIndex = content.indexOf("const supplier = formData.get('supplier') as string;");
content = content.substring(0, extractIndex) + "const supplier = formData.get('supplier') as string;\n    const clientName = formData.get('clientName') as string;\n" + content.substring(extractIndex + "const supplier = formData.get('supplier') as string;".length);

// 3. Add to newInvoice
const newInvoiceIndex = content.indexOf("supplier,\n        category,");
content = content.substring(0, newInvoiceIndex) + "supplier,\n        clientName,\n        category," + content.substring(newInvoiceIndex + "supplier,\n        category,".length);

fs.writeFileSync("src/components/widgets/FinanceWidget.tsx", content, "utf-8");
console.log("Updated FinanceWidget.tsx for clientName");

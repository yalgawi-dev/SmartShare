const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/FinanceWidget.tsx", "utf-8");

const handleAddRegex = /const amount = Number\(formData\.get\('amount'\)\);/m;
const handleAddReplacement = `let amount = Number(formData.get('amount'));
      const isCredit = formData.get('isCredit') === 'true';
      const isStoreCredit = formData.get('isStoreCredit') === 'true';
      if (isCredit) {
        amount = -Math.abs(amount);
      }`;

content = content.replace(handleAddRegex, handleAddReplacement);

const newInvoiceRegex = /amount,\s*supplier,\s*clientName,\s*category,/m;
const newInvoiceReplacement = `amount,
        isCredit,
        isStoreCredit,
        supplier,
        clientName,
        category,`;

content = content.replace(newInvoiceRegex, newInvoiceReplacement);

fs.writeFileSync("src/components/widgets/FinanceWidget.tsx", content, "utf-8");
console.log("Updated FinanceWidget.tsx for credit invoices");

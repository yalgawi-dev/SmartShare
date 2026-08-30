const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceTransactions.tsx", "utf-8");
content = content.replace(
  'updateInvoice(space.id, inv.id, { isActive: true }, user?.id || "me", "שחזור מחיקה");',
  'updateInvoice(space.id, inv.id, { isActive: true }, user?.realName || user?.id || "me", "שחזור מחיקה");'
);
fs.writeFileSync("src/components/widgets/Finance/FinanceTransactions.tsx", content, "utf-8");

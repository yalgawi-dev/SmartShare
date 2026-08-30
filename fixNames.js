const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceTransactions.tsx", "utf-8");

content = content.replace(
  "user?.id || 'me',",
  "user?.realName || user?.id || 'me',"
);

content = content.replace(
  "updateInvoice(space.id, inv.id, { isActive: false }, user?.id || 'me', 'מחיקת חשבונית')",
  "updateInvoice(space.id, inv.id, { isActive: false }, user?.realName || user?.id || 'me', 'נמחק על ידי המשתמש דרך הממשק')"
);
content = content.replace(
  "updateInvoice(space.id, inv.id, { isActive: false }, user?.id || 'me', 'מחיקה של הוצאה מהממשק')",
  "updateInvoice(space.id, inv.id, { isActive: false }, user?.realName || user?.id || 'me', 'נמחק על ידי המשתמש דרך הממשק')"
);

fs.writeFileSync("src/components/widgets/Finance/FinanceTransactions.tsx", content, "utf-8");

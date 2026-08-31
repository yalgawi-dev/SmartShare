const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/FinanceWidget.tsx", "utf-8");

content = content.replace(
  "{isMounted && createPortal(",
  "{isMounted && !isAddingExpense && !isScannerOpen && createPortal("
);

fs.writeFileSync("src/components/widgets/FinanceWidget.tsx", content, "utf-8");
console.log("Updated FinanceWidget to hide pill when modals are active");

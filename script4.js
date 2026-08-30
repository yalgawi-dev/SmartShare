
const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/FinanceWidget.tsx", "utf-8");

const oldFilter = `  const filteredInvoices = invoices.filter((inv: any) => {
    if (inv.isActive === false) return false;
    if (filter === "all") return true;`;

const newFilter = `  const filteredInvoices = invoices.filter((inv: any) => {
    if (filter === "archive") return inv.isActive === false;
    if (inv.isActive === false) return false;
    if (filter === "all") return true;`;

content = content.replace(oldFilter, newFilter);
fs.writeFileSync("src/components/widgets/FinanceWidget.tsx", content, "utf-8");


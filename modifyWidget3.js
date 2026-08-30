
const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/FinanceWidget.tsx", "utf-8");

const oldText = "if (inv.isActive === false) return false;\n    if (filter === 'all') return true;";
const newText = "if (filter === 'archive') return inv.isActive === false;\n    if (inv.isActive === false) return false;\n    if (filter === 'all') return true;";

content = content.replace("if (inv.isActive === false) return false;\r\n    if (filter === 'all') return true;", newText);
content = content.replace("if (inv.isActive === false) return false;\n    if (filter === 'all') return true;", newText);

fs.writeFileSync("src/components/widgets/FinanceWidget.tsx", content, "utf-8");
console.log("done widget 3");


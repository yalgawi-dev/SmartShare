
const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/FinanceWidget.tsx", "utf-8");
content = content.replace("if (filter === 'archive') return inv.isActive === false;\r\n    if (filter === 'archive') return inv.isActive === false;", "if (filter === 'archive') return inv.isActive === false;");
content = content.replace("if (filter === 'archive') return inv.isActive === false;\n    if (filter === 'archive') return inv.isActive === false;", "if (filter === 'archive') return inv.isActive === false;");
fs.writeFileSync("src/components/widgets/FinanceWidget.tsx", content, "utf-8");


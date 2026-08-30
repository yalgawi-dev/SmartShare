
const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/FinanceWidget.tsx", "utf-8");
content = content.replace("useState<\"all\" | \"pending_me\" | \"pending_partners\" | \"dispute\">", "useState<\"all\" | \"pending_me\" | \"pending_partners\" | \"dispute\" | \"archive\">");
content = content.replace("useState<'all' | 'pending_me' | 'pending_partners' | 'dispute'>", "useState<'all' | 'pending_me' | 'pending_partners' | 'dispute' | 'archive'>");
fs.writeFileSync("src/components/widgets/FinanceWidget.tsx", content, "utf-8");


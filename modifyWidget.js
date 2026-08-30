
const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/FinanceWidget.tsx", "utf-8");

const targetFilter = `  const filteredInvoices = invoices.filter((inv: any) => {
    if (inv.isActive === false) return false;
    if (filter === "all") return true;`;

const replacementFilter = `  const filteredInvoices = invoices.filter((inv: any) => {
    if (filter === "archive") return inv.isActive === false;
    if (inv.isActive === false) return false;
    if (filter === "all") return true;`;

content = content.replace(targetFilter, replacementFilter);

const targetType1 = `useState<"all" | "pending_me" | "pending_partners" | "dispute">("all")`;
const replacementType1 = `useState<"all" | "pending_me" | "pending_partners" | "dispute" | "archive">("all")`;
content = content.replace(targetType1, replacementType1);

const targetType2 = `useState<"all" | "pending_me" | "pending_partners" | "dispute">`;
const replacementType2 = `useState<"all" | "pending_me" | "pending_partners" | "dispute" | "archive">`;
content = content.replace(targetType2, replacementType2);

// try single quotes just in case
const targetType3 = `useState<'all' | 'pending_me' | 'pending_partners' | 'dispute'>('all')`;
const replacementType3 = `useState<'all' | 'pending_me' | 'pending_partners' | 'dispute' | 'archive'>('all')`;
content = content.replace(targetType3, replacementType3);

const targetType4 = `useState<'all' | 'pending_me' | 'pending_partners' | 'dispute'>`;
const replacementType4 = `useState<'all' | 'pending_me' | 'pending_partners' | 'dispute' | 'archive'>`;
content = content.replace(targetType4, replacementType4);

fs.writeFileSync("src/components/widgets/FinanceWidget.tsx", content, "utf-8");
console.log("done widget");


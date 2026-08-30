
const fs = require("fs");
let content = fs.readFileSync("src/app/context/SpacesContext.tsx", "utf-8");
let lines = content.split("\n");

const newText = `      if (performedBy && actionDetail && oldInvoice) {
        const isDelete = updates.isActive === false;
        const isRestore = updates.isActive === true;
        let actionLabel = isDelete ? "מחק/ה הוצאה" : isRestore ? "שחזר/ה הוצאה מחוקה" : "ערך/ה הוצאה";
        const amt = oldInvoice.amount ? \` ע"ס ₪\${oldInvoice.amount}\` : "";
        const supplier = oldInvoice.supplier || "ספק כללי";
        
        const newLog = {
          id: \`audit-\${Date.now()}-\${Math.random().toString(36).substr(2, 5)}\`,
          timestamp: new Date().toISOString(),
          actionType: isDelete ? "DELETE_INVOICE" : "EDIT_INVOICE",
          performedBy,
          details: \`\${actionLabel}\${amt} מאת (\${supplier}). פירוט: \${actionDetail}\`,
          invoiceId
        };
        newSpace.auditLogs = [newLog, ...(space.auditLogs || [])];
      }`;

lines.splice(408, 11, newText);

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("details: string; // Human readable explanation")) {
    lines[i] = lines[i] + "\n  invoiceId?: string;";
    break;
  }
}

fs.writeFileSync("src/app/context/SpacesContext.tsx", lines.join("\n"), "utf-8");
console.log("done");


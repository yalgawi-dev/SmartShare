const fs = require("fs");
let content = fs.readFileSync("src/app/context/SpacesContext.tsx", "utf-8");

const startRegex = /if \(performedBy && actionDetail && oldInvoice\)\s*\{/;
const startMatch = content.match(startRegex);
if (!startMatch) {
    console.log("Start not found");
    process.exit(1);
}
const startIdx = startMatch.index;

const endRegex = /return newSpace;/;
endMatch = endRegex.exec(content.substring(startIdx));
if (!endMatch) {
    console.log("End not found");
    process.exit(1);
}
const endIdx = startIdx + endMatch.index;

const newLogic = `if (performedBy && actionDetail && oldInvoice) {
        const isDelete = updates.isActive === false;
        const isRestore = updates.isActive === true;
        let actionLabel = isDelete ? "מחק/ה הוצאה" : isRestore ? "שחזר/ה הוצאה מחוקה" : "ערך/ה הוצאה";
        const amt = oldInvoice.amount ? \` ע"ס ₪\${oldInvoice.amount}\` : "";
        const supplier = oldInvoice.supplier || "ספק כללי";
        
        const performer = performedBy === "me" || !performedBy ? "משתמש" : performedBy;
        
        const newLog = {
          id: \`audit-\${Date.now()}-\${Math.random().toString(36).substr(2, 5)}\`,
          timestamp: new Date().toISOString(),
          actionType: isDelete ? "DELETE_INVOICE" : "EDIT_INVOICE",
          performedBy,
          details: \`\${performer} \${actionLabel}\${amt} מאת "\${supplier}". פירוט: \${actionDetail}\`,
          invoiceId
        };
        newSpace.auditLogs = [newLog, ...(space.auditLogs || [])];
      }

      `;

content = content.substring(0, startIdx) + newLogic + content.substring(endIdx);
fs.writeFileSync("src/app/context/SpacesContext.tsx", content, "utf-8");
console.log("Success");


const fs = require("fs");
let content = fs.readFileSync("src/app/context/SpacesContext.tsx", "utf-8");
const startIdx = content.indexOf("if (performedBy && actionDetail && oldInvoice) {");
const endIdx = content.indexOf("return newSpace;");
const oldText = content.substring(startIdx, endIdx);
const newText = `if (performedBy && actionDetail && oldInvoice) {
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
      }\n\n      `;
content = content.replace(oldText, newText);
fs.writeFileSync("src/app/context/SpacesContext.tsx", content, "utf-8");
console.log("Replaced:", oldText !== content);


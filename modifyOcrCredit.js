const fs = require("fs");
let content = fs.readFileSync("src/app/api/ocr/route.ts", "utf-8");

const oldPrompt = /- "invoiceNumber": Invoice number or Receipt number/;
const newPrompt = `- "isCreditInvoice": True ONLY if the document explicitly says "חשבונית זיכוי" (Credit Invoice / Refund). False if it is a normal invoice or receipt.
      - "invoiceNumber": Invoice number or Receipt number`;

content = content.replace(oldPrompt, newPrompt);

const oldSchema = /vatNumber: \{ type: "STRING", description: "VAT Number \/ Osek Murshe \(\?\-\.\?\? \/ \?\.\?\?\)" \}/;
const newSchema = `vatNumber: { type: "STRING", description: "VAT Number" },
            isCreditInvoice: { type: "BOOLEAN", description: "True if the document is a credit invoice (חשבונית זיכוי)" }`;

content = content.replace(oldSchema, newSchema);

fs.writeFileSync("src/app/api/ocr/route.ts", content, "utf-8");
console.log("Updated OCR route.ts for isCreditInvoice");

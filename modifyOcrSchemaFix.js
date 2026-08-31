const fs = require("fs");
let content = fs.readFileSync("src/app/api/ocr/route.ts", "utf-8");

// 1. Update the prompt to include a JSON template since we are removing responseSchema
const startIdx = content.indexOf("const prompt = `");
const endIdx = content.indexOf("`;", startIdx) + 2;

const newPrompt = `const prompt = \`
      Please read this Israeli invoice/receipt carefully.
      Return ONLY a valid JSON object with the following keys. If a field is missing, use null.
      
      {
        "vendor": "Name of the business (ספק). Look for the biggest text or logo.",
        "clientName": "Name of the CUSTOMER buying the service (לכבוד / עבור). Do not write the vendor's name here.",
        "amount": Total amount to pay as a NUMBER (סה"כ לתשלום).,
        "vatAmount": The VAT amount as a NUMBER.,
        "documentType": "מקור", "העתק", or "נאמן למקור".,
        "date": "Date of invoice in YYYY-MM-DD format",
        "isCreditInvoice": true/false (True ONLY if it says "חשבונית זיכוי"),
        "invoiceNumber": "Invoice or Receipt number",
        "vatNumber": "Company VAT Number (ח.פ / ע.מ)"
      }
    \`;`;

content = content.substring(0, startIdx) + newPrompt + content.substring(endIdx);

// 2. Remove the responseSchema from generationConfig
const configRegex = /generationConfig:\s*\{\s*responseMimeType:\s*"application\/json",\s*responseSchema:\s*\{[\s\S]*?\}\s*\}/;
content = content.replace(configRegex, `generationConfig: {\n        responseMimeType: "application/json"\n      }`);

fs.writeFileSync("src/app/api/ocr/route.ts", content, "utf-8");
console.log("Updated route.ts: Removed responseSchema to prevent model hangs, added JSON template to prompt.");

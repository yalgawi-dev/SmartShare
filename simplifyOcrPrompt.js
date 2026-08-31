const fs = require("fs");
let content = fs.readFileSync("src/app/api/ocr/route.ts", "utf-8");

const startIdx = content.indexOf("const prompt = `");
const endIdx = content.indexOf("`;", startIdx) + 2;

if (startIdx !== -1 && endIdx !== -1) {
  const newPrompt = `const prompt = \`
      Please read this Israeli invoice/receipt carefully.
      Extract the following fields and return them strictly in the JSON format requested by the schema.
      - "vendor": Name of the business (ספק). Look for the biggest text or the logo at the top.
      - "clientName": Name of the CUSTOMER buying the service (לכבוד / עבור). Do not write the vendor's name here. If not found, leave null.
      - "amount": Total amount to pay as a number (סה"כ לתשלום).
      - "vatAmount": The VAT amount as a number. If missing, calculate from total using \${vatRate}% rate.
      - "documentType": Document type: "מקור", "העתק", or "נאמן למקור".
      - "date": Date of invoice in YYYY-MM-DD format.
      - "isCreditInvoice": True ONLY if it says "חשבונית זיכוי" (Credit Invoice). False otherwise.
      - "invoiceNumber": Invoice or Receipt number.
      - "vatNumber": Company VAT Number (ח.פ / ע.מ). Usually 9 digits.
      
      If you cannot find a field, leave it null.
    \`;`;

  content = content.substring(0, startIdx) + newPrompt + content.substring(endIdx);
  fs.writeFileSync("src/app/api/ocr/route.ts", content, "utf-8");
  console.log("Simplified prompt for Flash Lite successfully.");
} else {
  console.log("Could not find prompt block.");
}

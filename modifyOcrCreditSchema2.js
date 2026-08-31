const fs = require("fs");
let content = fs.readFileSync("src/app/api/ocr/route.ts", "utf-8");

content = content.replace(
  /vatNumber:\s*\{[^\}]+\}/,
  (match) => match + ",\n            isCreditInvoice: { type: \"BOOLEAN\", description: \"True if credit invoice (חשבונית זיכוי)\" }"
);

fs.writeFileSync("src/app/api/ocr/route.ts", content, "utf-8");
console.log("Forced update OCR route.ts schema successfully");

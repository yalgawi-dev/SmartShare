const fs = require("fs");
let content = fs.readFileSync("src/app/api/ocr/route.ts", "utf-8");

// 1. Add to prompt
const promptRegex = /-\s*"vendor":.*?$/m;
content = content.replace(promptRegex, (match) => {
  return match + '\n      - "clientName": Name of the recipient/client the invoice is billed to (מקבל השירות / לכבוד / שם הלקוח). If not explicitly stated, leave null.';
});

// 2. Add to schema
const schemaRegex = /vendor:\s*\{\s*type:\s*"STRING",\s*description:\s*"Name of the business[^"]*"\s*\},\s*/m;
content = content.replace(schemaRegex, (match) => {
  return match + 'clientName: { type: "STRING", description: "Name of the client/recipient (מקבל השירות / לכבוד)" },\n            ';
});

fs.writeFileSync("src/app/api/ocr/route.ts", content, "utf-8");
console.log("Updated OCR route.ts schema and prompt");

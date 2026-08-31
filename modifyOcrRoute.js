const fs = require("fs");
let content = fs.readFileSync("src/app/api/ocr/route.ts", "utf-8");

content = content.replace(
  `- "vendor": Name of the business (שם עסק). Look for the biggest text or the logo at the top.`,
  `- "vendor": Name of the business (שם העסק / ספק). Look for the biggest text or the logo at the top.\n      - "clientName": Name of the recipient/client the invoice is billed to (מקבל השירות / לכבוד / שם הלקוח). If not explicitly stated, leave null.`
);

fs.writeFileSync("src/app/api/ocr/route.ts", content, "utf-8");
console.log("Updated OCR route.ts");

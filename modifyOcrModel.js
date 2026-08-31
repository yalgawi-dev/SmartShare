const fs = require("fs");
let content = fs.readFileSync("src/app/api/ocr/route.ts", "utf-8");

// Upgrade Model
content = content.replace(
  "const model = 'gemini-flash-lite-latest';",
  "const model = 'gemini-1.5-flash-latest';"
);

// Enhance Prompt
const oldClientPrompt = /- "clientName": Name of the recipient\/client the invoice is billed to \(מקבל השירות \/ לכבוד \/ שם הלקוח\)\. If not explicitly stated, leave null\./;
const newClientPrompt = `- "clientName": Name of the customer/recipient (מקבל השירות / שם הלקוח / לכבוד). Look carefully in the document for labels like 'לכבוד', 'עבור', or 'שם הלקוח' and extract the name next to or below them.`;

content = content.replace(oldClientPrompt, newClientPrompt);

// Also enhance vendor prompt just in case
content = content.replace(
  /- "vendor": Name of the business \(שם העסק \/ ספק\)\. Look for the biggest text or the logo at the top\./,
  `- "vendor": Name of the business issuing the invoice (שם העסק / ספק / מוכר). Usually at the top, biggest text or near the logo.`
);

fs.writeFileSync("src/app/api/ocr/route.ts", content, "utf-8");
console.log("Upgraded OCR model and enhanced prompts");

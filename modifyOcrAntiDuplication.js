const fs = require("fs");
let content = fs.readFileSync("src/app/api/ocr/route.ts", "utf-8");

const oldClientPrompt = /- "clientName": Name of the customer\/recipient \(מקבל השירות \/ שם הלקוח \/ לכבוד\)\. Look carefully in the document for labels like 'לכבוד', 'עבור', or 'שם הלקוח' and extract the name next to or below them\./;
const newClientPrompt = `- "clientName": Name of the CUSTOMER buying the service (מקבל השירות / שם הלקוח / לכבוד). Look for 'לכבוד' or 'עבור'. CRITICAL RULE: If the client name is the exact same as the vendor/business name, leave this field NULL! Do not duplicate the business name.`;

content = content.replace(oldClientPrompt, newClientPrompt);

fs.writeFileSync("src/app/api/ocr/route.ts", content, "utf-8");
console.log("Updated OCR route.ts for anti-duplication");

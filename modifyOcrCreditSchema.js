const fs = require("fs");
let content = fs.readFileSync("src/app/api/ocr/route.ts", "utf-8");

const endOfProperties = "}\n        }\n      }\n    };";
const replacement = "  isCreditInvoice: { type: \"BOOLEAN\", description: \"True if credit invoice\" }\n          }\n        }\n      }\n    };";

content = content.replace(endOfProperties, replacement);

fs.writeFileSync("src/app/api/ocr/route.ts", content, "utf-8");
console.log("Updated OCR route.ts schema successfully");

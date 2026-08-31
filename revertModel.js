const fs = require("fs");
let content = fs.readFileSync("src/app/api/ocr/route.ts", "utf-8");

content = content.replace(
  "const model = 'gemini-1.5-flash-latest';",
  "const model = 'gemini-flash-lite-latest';"
);

fs.writeFileSync("src/app/api/ocr/route.ts", content, "utf-8");
console.log("Reverted model to gemini-flash-lite-latest");

const fs = require("fs");
let content = fs.readFileSync("src/app/api/ocr/route.ts", "utf-8");

const startRequest = content.indexOf("const requestBody = {");
const endRequest = content.indexOf("};", startRequest) + 2;

const newRequestBody = `const requestBody = {
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Data } }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };`;

content = content.substring(0, startRequest) + newRequestBody + content.substring(endRequest);

fs.writeFileSync("src/app/api/ocr/route.ts", content, "utf-8");
console.log("Fixed requestBody syntax error");

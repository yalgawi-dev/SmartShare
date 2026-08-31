
const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf-8");
content = content.replace("v4.5.57", "v4.5.58");
fs.writeFileSync("src/app/page.tsx", content, "utf-8");


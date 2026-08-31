
const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf-8");
content = content.replace("v4.5.53", "v4.5.54");
fs.writeFileSync("src/app/page.tsx", content, "utf-8");



const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf-8");
content = content.replace("v4.5.40", "v4.5.41");
content = content.replace("צמצום תצוגת מע\"מ והרחבת רמת הפירוט ביומן השקיפות.", "הסתרת קוביות המאזן והמתנה לאישור במצב של שחקן יחיד, ועמודת מאזן.");
fs.writeFileSync("src/app/page.tsx", content, "utf-8");


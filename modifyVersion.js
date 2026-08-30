
const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf-8");
content = content.replace("v4.5.37 - הרחבת לוג המחיקות עם פירוט מדויק, והוספת ארכיון שחזור הוצאות מחוקות.", "v4.5.38 - ארגון מחדש של לוח הבקרה למנהלים: הפרדת מנהלים, הרשאות גישה, והעברת ארכיון למשתמש הכללי.");
fs.writeFileSync("src/app/page.tsx", content, "utf-8");
console.log("done version");


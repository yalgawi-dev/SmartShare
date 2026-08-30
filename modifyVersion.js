const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf-8");
content = content.replace("v4.5.39", "v4.5.40");
content = content.replace("ארגון מחדש של לוח הבקרה למנהלים: הפרדת מנהלים, הרשאות גישה, והעברת ארכיון למשתמש הכללי.", "צמצום תצוגת מע\"מ והרחבת רמת הפירוט ביומן השקיפות.");
fs.writeFileSync("src/app/page.tsx", content, "utf-8");

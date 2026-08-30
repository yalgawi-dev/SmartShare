
const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf-8");
content = content.replace("v4.5.36 - שמירת היסטוריית שותפים לא-פעילים בטבלת מאזנים, והתראת שקיפות לפני הסרת שותפים עם Audit Log.", "v4.5.37 - הרחבת לוג המחיקות עם פירוט מדויק, והוספת ארכיון שחזור הוצאות מחוקות.");
fs.writeFileSync("src/app/page.tsx", content, "utf-8");


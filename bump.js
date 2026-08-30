
const fs = require("fs");
let content = fs.readFileSync("src/app/page.tsx", "utf-8");
content = content.replace("v4.5.42", "v4.5.43");
content = content.replace("שדרוג עיצוב מסך ההגדרות לחוויית משתמש מודרנית (שמירה אוטומטית, חלוקה ברורה) והקפאת תפריט עליון בדוחות.", "אחידות עיצוב ושיפור ממשק משתמש בדף הגדרות החשבון ומסך האדמין (CRM) ושדרוג ארכיון מחוקים עם אפשרות שחזור מפורטת.");
fs.writeFileSync("src/app/page.tsx", content, "utf-8");


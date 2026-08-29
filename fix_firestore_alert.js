const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf8');

c = c.replace(/console\.error\("Firestore error:", error\);/g, 'console.error("Firestore error:", error);\n         alert("שגיאת התחברות למסד הנתונים: " + (error.message || ""));');

let p = fs.readFileSync('src/app/page.tsx', 'utf8');
const base64Hebrew = Buffer.from('תיקון התחברות גוגל (גרסה 5 - התראות שגיאה)').toString('base64');
p = p.replace(/v4\.5\.1[0-9] - [^<]*/, 'v4.5.15 - ' + Buffer.from(base64Hebrew, 'base64').toString('utf8'));
fs.writeFileSync('src/app/page.tsx', p, 'utf8');

fs.writeFileSync('src/app/context/SpacesContext.tsx', c, 'utf8');

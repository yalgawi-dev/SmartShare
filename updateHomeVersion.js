const fs = require('fs');
let c = fs.readFileSync('src/app/page.tsx', 'utf-8');
c = c.replace(/v4\.7\.12 - .*?מחוקים עם אפשרות שחזור מפורטת\./, 'v4.7.13 - תיקון אלגוריתם הלבנת צללים ורעשים במנוע הסורק (Invoice+), ופתרון באג הרשאות יצירת מרחב.');
fs.writeFileSync('src/app/page.tsx', c);
console.log('Updated home page version');

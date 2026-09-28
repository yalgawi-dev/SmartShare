const fs = require('fs');
const file = 'src/app/context/AuthContext.tsx';
let content = fs.readFileSync(file, 'utf8');

const chromeAlert = `alert('⚠ חסימת פופאפים פעילה בדפדפן זה (סמסונג/פנימי).\\n\\nכדי להתחבר בהצלחה ולהתגבר על הבעיה:\\n1. העתק את הכתובת של האתר\\n2. פתח דפדפן כרום (Chrome) רגיל\\n3. הדבק את הכתובת והתחבר שם.');`;
const otherAlert = `alert('⚠ חסימת פופאפים פעילה بدפדפן זה (סמסונג/פנימי).\\n\\nכדי להתחבר בהצלחה ולהתגבר על הבעיה:\\n1. העתק את הכתובת של האתר\\n2. פתח דפדפן כרום (Chrome) רגיל\\n3. הדבק את הכתובת והתחבר שם.');`;

// Remove the alerts but keep throwing the error so the UI can catch it
content = content.replace(chromeAlert, '');
content = content.replace(chromeAlert, '');
content = content.replace(otherAlert, '');
content = content.replace(otherAlert, '');

fs.writeFileSync(file, content, 'utf8');
console.log("Removed raw alerts from AuthContext");

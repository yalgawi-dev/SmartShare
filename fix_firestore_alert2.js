const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf8');

c = c.split('console.error("Firestore error:", error);').join('console.error("Firestore error:", error);\n         alert("שגיאת התחברות למסד הנתונים: " + (error.message || ""));');

fs.writeFileSync('src/app/context/SpacesContext.tsx', c, 'utf8');

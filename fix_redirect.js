const fs = require('fs');
const file = 'src/app/context/AuthContext.tsx';
let content = fs.readFileSync(file, 'utf8');

const redirectCode = `if (window.confirm('הדפדפן חסם את החלון הקופץ. האם להמשיך להתחברות באותו מסך (Redirect)?')) {
             await signInWithRedirect(auth, googleProvider); // or Facebook, but we will let user re-click for now
          }`;

const chromeAlert = `alert('⚠ חסימת פופאפים פעילה بدפדפן זה (סמסונג/פנימי).\\n\\nכדי להתחבר בהצלחה ולהתגבר על הבעיה:\\n1. העתק את הכתובת של האתר\\n2. פתח דפדפן כרום (Chrome) רגיל\\n3. הדבק את הכתובת והתחבר שם.');`;

content = content.replace(redirectCode, chromeAlert);
// And for Facebook
content = content.replace(`if (window.confirm('הדפדפן חסם את החלון הקופץ. האם להמשיך להתחברות באותו מסך (Redirect)?')) {
             await signInWithRedirect(auth, googleProvider); // or Facebook, but we will let user re-click for now
          }`, chromeAlert);

fs.writeFileSync(file, content, 'utf8');
console.log("Reverted to Chrome alert");

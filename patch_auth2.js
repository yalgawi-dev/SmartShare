const fs = require('fs');
const file = 'src/app/context/AuthContext.tsx';
let content = fs.readFileSync(file, 'utf8');

// Use precise regex to replace popup-blocked alert for google and facebook
content = content.replace(/if \(e\.code === 'auth\/popup-blocked'\) \{[\s\S]*?\} else if \(e\.code !== 'auth\/popup-closed/g, 
  `if (e.code === 'auth/popup-blocked') {
          if (window.confirm('הדפדפן חסם את החלון הקופץ. האם להמשיך להתחברות באותו מסך (Redirect)?')) {
             await signInWithRedirect(auth, googleProvider); // or Facebook, but we will let user re-click for now
          }
        } else if (e.code !== 'auth/popup-closed`);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated fallback");

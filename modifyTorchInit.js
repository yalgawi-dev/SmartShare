const fs = require("fs");
let content = fs.readFileSync("src/hooks/useCamera.ts", "utf-8");

const startCameraRegex = /let constraints:\s*MediaStreamConstraints\s*=\s*\{\s*video:\s*\{\s*facingMode:\s*'environment',\s*width:\s*\{\s*ideal:\s*4000\s*\},\s*height:\s*\{\s*ideal:\s*4000\s*\}\s*\}\s*\};/m;

const newConstraints = `let constraints: MediaStreamConstraints = {
          video: { 
            facingMode: 'environment', 
            width: { ideal: 4000 }, 
            height: { ideal: 4000 }
          } as any
        };
        // Some devices require torch to be requested at stream creation to reserve the hardware
        if (typeof window !== 'undefined') {
          (constraints.video as any).advanced = [{ torch: false }];
        }`;

content = content.replace(startCameraRegex, newConstraints);

// Also modify toggleTorch to handle the error more gracefully
const toggleRegex = /catch \(innerErr\) \{\s*alert\("[^"]+"\);\s*\}/m;
content = content.replace(toggleRegex, `catch (innerErr: any) {
        alert("שגיאת פלאש: " + (innerErr.name || innerErr.message) + ". נסה להחליף מצלמה (כפתור החלפה), ייתכן והמצלמה הנוכחית היא עדשה רחבה ללא פלאש.");
      }`);

fs.writeFileSync("src/hooks/useCamera.ts", content, "utf-8");
console.log("Updated useCamera.ts with initial torch constraint and better error message");

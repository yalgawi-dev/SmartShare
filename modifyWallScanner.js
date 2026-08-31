const fs = require("fs");
let content = fs.readFileSync("src/app/space/[id]/page.tsx", "utf-8");

// Remove ScannerWidget completely from the wall if Finance is active.
// Actually, let's just make it so ScannerWidget is never rendered as a separate widget on the wall,
// because Scanner is now a capability embedded in the + button!
// If they have scanner feature enabled, it unlocks the Camera icon.

const scannerWidgetRegex = /\{\/\* Scanner Widget \- No remove button for templates \*\/\}\s*\{hasScanner && !isGuestMode && \([\s\S]*?<\/ScannerWidget>\s*\)\}/g;
content = content.replace(scannerWidgetRegex, "");

// Wait, the regex might fail if it's not exact. Let's do string replacement.
const exactScannerString = `{/* Scanner Widget - No remove button for templates */}
          {hasScanner && !isGuestMode && (
            <ScannerWidget 
               
              onScanComplete={(imgUrl) => setScannedImage(imgUrl)} 
            />
          )}`;
content = content.replace(exactScannerString, "");
// If the regex didn't catch it because of missing onRemove or spaces, let's try a safer regex:
const saferRegex = /\{\/\*\s*Scanner Widget[\s\S]*?<ScannerWidget[\s\S]*?\/>\s*\)\}/g;
content = content.replace(saferRegex, "");

fs.writeFileSync("src/app/space/[id]/page.tsx", content, "utf-8");
console.log("Updated SpaceWallPage to remove ScannerWidget");

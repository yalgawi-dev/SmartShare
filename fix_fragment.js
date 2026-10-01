const fs = require('fs');
let widget = fs.readFileSync('src/components/widgets/Vault/DocumentsWidget.tsx', 'utf8');

// The activeShelf block ends with:
//         </div>
//         </div>
//         {pendingImport && (
// ...
//         )}
//       );
//     }

// I need to wrap it in <> </>
// Let's replace the start of the return:
const returnStartRegex = /return \(\s*<div style=\{\{ padding: '1rem 0', paddingBottom: '6rem' \}\}>/;
widget = widget.replace(returnStartRegex, "return (\n      <>\n        <div style={{ padding: '1rem 0', paddingBottom: '6rem' }}>");

const returnEndRegex = /        \}<button onClick=\{\(\) => setPreviewState\(null\)\} style=\{\{ position: 'absolute', top: '20px', right: '20px', background: 'rgba\(255,255,255,0\.2\)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1\.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20001 \}\}>✕<\/button>\s*<div style=\{\{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX\(-50%\)', color: 'white', background: 'rgba\(0,0,0,0\.5\)', padding: '5px 15px', borderRadius: '20px', fontSize: '0\.9rem', zIndex: 20001 \}\}>\s*\{previewState\.index \+ 1\} \/ \{previewState\.docs\.length\}\s*<\/div>\s*<\/div>\s*\)\}\s*\);\s*\}/;

// Wait, doing it by exact string is easier.
// Look for where previewState ends in activeShelf.
// It ends exactly before `      );\n    }` (the first one).
const badReturnEndRegex = /\)\}\s*\);\s*\}/;
// Actually, `widget.replace` on `);\n    }` where we injected it.


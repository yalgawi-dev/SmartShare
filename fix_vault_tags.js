const fs = require('fs');
let lines = fs.readFileSync('src/components/widgets/Vault/DocumentsWidget.tsx', 'utf8').split('\n');

const errLine = 346;
console.log(lines.slice(340, 355).join('\n'));

// Let's remove lines 346 and 347 which are:
//         )}
//       </div>
lines.splice(345, 2);

fs.writeFileSync('src/components/widgets/Vault/DocumentsWidget.tsx', lines.join('\n'));
console.log('Fixed duplicate tags');

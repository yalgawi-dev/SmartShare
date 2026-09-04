const fs = require('fs');
let c = fs.readFileSync('src/utils/partnerUtils.ts', 'utf-8');

// Replace the bad line that has a double backslash
c = c.replace(
  /return `.*?\$\{hoursLeft\}.*?\$\{minsRound > 0 \? .*? \: ''\}`;/,
  "return `נותרו ${hoursLeft} ש' ${minsRound > 0 ? \"ו-\" + minsRound + \" דק'\" : \"\"}`;"
);

// Actually, since the file has garbled hebrew (from my previous write_to_file), I should rewrite the whole file cleanly.
fs.writeFileSync('src/utils/partnerUtils.ts', c);
console.log('Fixed partnerUtils.ts');

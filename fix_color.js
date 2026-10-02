const fs = require('fs');
let txt = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf8');

const search = "el.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';";
const replace = "el.style.backgroundColor = 'rgba(253, 224, 71, 0.6)';";

txt = txt.replace(search, replace);

const searchTime = "setTimeout(() => el.style.backgroundColor = oldBg, 2500);";
const replaceTime = "setTimeout(() => el.style.backgroundColor = oldBg, 3500);";

txt = txt.replace(searchTime, replaceTime);

fs.writeFileSync('src/app/space/[id]/page.tsx', txt);
console.log('Replaced highlight');

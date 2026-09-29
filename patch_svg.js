const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', 'utf8');

c = c.replace(
  />\s*✉️\s*\{unreadMessagesCount/,
  '>\n              <svg width="24" height="24" viewBox="0 0 24 24" fill="#eab308" stroke="#ca8a04" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7.00005L10.2 11.65C11.2667 12.45 12.7333 12.45 13.8 11.65L20 7" /><rect x="3" y="5" width="18" height="14" rx="2" /></svg>\n              {unreadMessagesCount'
);

fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/page.tsx', c, 'utf8');

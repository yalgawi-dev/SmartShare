const fs = require('fs');

// 1. Fix page.tsx carousel
let pageTx = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf8');
pageTx = pageTx.replace(
  "display: 'flex', \n          overflowX: 'auto', \n          gap: '1rem', \n          scrollSnapType: 'x mandatory', \n          scrollbarWidth: 'none', \n          WebkitOverflowScrolling: 'touch',\n          paddingBottom: '0.5rem'",
  "display: 'flex', \n          flexDirection: 'column', \n          gap: '1rem', \n          paddingBottom: '0.5rem'"
);
// In case the whitespace doesn't perfectly match, let's just do a regex replace
pageTx = pageTx.replace(/display:\s*'flex',\s*overflowX:\s*'auto',\s*gap:\s*'1rem',\s*scrollSnapType:\s*'x mandatory',\s*scrollbarWidth:\s*'none',\s*WebkitOverflowScrolling:\s*'touch',\s*paddingBottom:\s*'0.5rem'/g, 
  "display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '0.5rem'"
);
fs.writeFileSync('src/app/space/[id]/page.tsx', pageTx);

// 2. Fix PushNotificationReminder.tsx
let pushTx = fs.readFileSync('src/components/widgets/PushNotificationReminder.tsx', 'utf8');
pushTx = pushTx.replace(/flexShrink: 0, minWidth: '100%', scrollSnapAlign: 'center', boxSizing: 'border-box', /g, '');
pushTx = pushTx.replace("if (permission === 'granted') return;", "if (permission === 'granted' || permission === 'denied') return;");
fs.writeFileSync('src/components/widgets/PushNotificationReminder.tsx', pushTx);

// 3. Fix PendingApprovalBanner.tsx
let paTx = fs.readFileSync('src/components/widgets/Partners/PendingApprovalBanner.tsx', 'utf8');
paTx = paTx.replace(/flexShrink: 0, minWidth: '100%', scrollSnapAlign: 'center', boxSizing: 'border-box', /g, '');
fs.writeFileSync('src/components/widgets/Partners/PendingApprovalBanner.tsx', paTx);

// 4. Fix CreatorDisputesBanner.tsx
let cdTx = fs.readFileSync('src/components/widgets/Partners/CreatorDisputesBanner.tsx', 'utf8');
cdTx = cdTx.replace(/flexShrink: 0, minWidth: '100%', scrollSnapAlign: 'center', boxSizing: 'border-box', /g, '');
fs.writeFileSync('src/components/widgets/Partners/CreatorDisputesBanner.tsx', cdTx);

// 5. Fix PendingInvoicesBanner.tsx
let piTx = fs.readFileSync('src/components/widgets/Finance/PendingInvoicesBanner.tsx', 'utf8');
piTx = piTx.replace(/<div style=\{\{ flexShrink: 0, minWidth: '100%', scrollSnapAlign: 'center', boxSizing: 'border-box' \}\}>\r?\n/g, '<>\n');
// Replace the last </div></div> with </div></>
piTx = piTx.replace(/<\/div>\r?\n\s*<\/div>\r?\n\s*\);\r?\n\}\r?\n?$/g, '</div>\n    </>\n  );\n}\n');
fs.writeFileSync('src/components/widgets/Finance/PendingInvoicesBanner.tsx', piTx);

console.log("All fixes applied");

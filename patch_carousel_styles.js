const fs = require('fs');

function addCarouselStyles(filePath) {
  if (!fs.existsSync(filePath)) return;
  let tx = fs.readFileSync(filePath, 'utf8');
  
  // Find the first style={{ or style={{...}} that is the root container.
  // We can just replace the first `style={{` with `style={{ flexShrink: 0, minWidth: '100%', scrollSnapAlign: 'center', boxSizing: 'border-box', `
  // But wait, what if it's already there?
  if (tx.includes('scrollSnapAlign')) return;
  
  // Find first return ( <div style={{...
  const firstDivMatch = tx.match(/return\s*\(\s*<div[^>]*style=\{\{/);
  if (firstDivMatch) {
    tx = tx.replace(firstDivMatch[0], firstDivMatch[0] + " flexShrink: 0, minWidth: '100%', scrollSnapAlign: 'center', boxSizing: 'border-box', ");
    fs.writeFileSync(filePath, tx);
    console.log("Patched", filePath);
  } else {
    console.log("Could not find root div with style for", filePath);
  }
}

addCarouselStyles('src/components/widgets/Finance/PendingInvoicesBanner.tsx');
addCarouselStyles('src/components/widgets/Partners/CreatorDisputesBanner.tsx');
addCarouselStyles('src/components/widgets/Partners/PendingApprovalBanner.tsx');
addCarouselStyles('src/components/widgets/PushNotificationReminder.tsx');

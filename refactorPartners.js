const fs = require('fs');

// 1. Update FinanceSummary.tsx
let financePath = 'src/components/widgets/Finance/FinanceSummary.tsx';
let finance = fs.readFileSync(financePath, 'utf-8');

// Add import
if (!finance.includes('getRemainingTimeText')) {
    // Should already be there but we are extracting it.
}
finance = finance.replace("import { createPortal } from 'react-dom';", "import { createPortal } from 'react-dom';\nimport { getRemainingTimeText } from '../../../utils/partnerUtils';");

// Remove local function
finance = finance.replace(/const getRemainingTimeText = \(joinedAt: string\) => {[\s\S]*?};/, "");

// Fix the call inside FinanceSummary to pass expHours
finance = finance.replace(
  `getRemainingTimeText((b as any).joinedAt)`, 
  `getRemainingTimeText((b as any).joinedAt, space.settings?.pendingExpirationHours || 1)`
);

fs.writeFileSync(financePath, finance);
console.log('Updated FinanceSummary');

// 2. Update PendingApprovalBanner.tsx
let bannerPath = 'src/components/widgets/PendingApprovalBanner.tsx';
let banner = fs.readFileSync(bannerPath, 'utf-8');

// Add import
banner = banner.replace("import { useAuth } from '../../app/context/AuthContext';", "import { useAuth } from '../../app/context/AuthContext';\nimport { getRemainingTimeText } from '../../utils/partnerUtils';");

// Remove local function
banner = banner.replace(/const getRemainingTimeText = \(joinedAt: string\) => {[\s\S]*?};/, "");

// Fix the call inside banner to pass expHours
banner = banner.replace(
  `getRemainingTimeText(currentMember.joinedAt)`,
  `getRemainingTimeText(currentMember.joinedAt, space.settings?.pendingExpirationHours || 1)`
);

fs.writeFileSync(bannerPath, banner);
console.log('Updated PendingApprovalBanner');

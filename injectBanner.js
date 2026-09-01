const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'app', 'space', '[id]', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Add import
const importTarget = "import GuestOnboardingModal from '../../../components/widgets/GuestOnboardingModal';";
const importReplacement = `import GuestOnboardingModal from '../../../components/widgets/GuestOnboardingModal';
import PendingApprovalBanner from '../../../components/widgets/PendingApprovalBanner';`;
if (content.includes(importTarget) && !content.includes("PendingApprovalBanner")) {
  content = content.replace(importTarget, importReplacement);
}

// Add component
const bannerTarget = "{isGuestMode && <GuestOnboardingModal />}";
const bannerReplacement = `{isGuestMode && <GuestOnboardingModal />}
        <PendingApprovalBanner spaceId={space.id} inviteToken={new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('invite')} />`;
if (content.includes(bannerTarget) && !content.includes("<PendingApprovalBanner")) {
  content = content.replace(bannerTarget, bannerReplacement);
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Injected PendingApprovalBanner into space page');

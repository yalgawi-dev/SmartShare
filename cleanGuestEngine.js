const fs = require('fs');

// 1. Providers.tsx
let prov = fs.readFileSync('src/app/Providers.tsx', 'utf-8');
prov = prov.replace("import { GuestProvider } from './context/GuestContext';\n", "");
prov = prov.replace("<GuestProvider>\n", "");
prov = prov.replace("</GuestProvider>\n", "");
fs.writeFileSync('src/app/Providers.tsx', prov, 'utf-8');
console.log('Cleaned Providers.tsx');

// 2. space/[id]/page.tsx
let page = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf-8');
page = page.replace("import GuestOnboardingModal from '../../../components/widgets/GuestOnboardingModal';\n", "");
page = page.replace("{isGuestMode && <GuestOnboardingModal />}\n", "");
fs.writeFileSync('src/app/space/[id]/page.tsx', page, 'utf-8');
console.log('Cleaned page.tsx');

// 3. TopGuestsWidget.tsx
let topg = fs.readFileSync('src/components/widgets/TopGuestsWidget.tsx', 'utf-8');
topg = topg.replace("import { useGuest } from '../../app/context/GuestContext';\n", "");
topg = topg.replace("  const { profile } = useGuest();\n", "");
fs.writeFileSync('src/components/widgets/TopGuestsWidget.tsx', topg, 'utf-8');
console.log('Cleaned TopGuestsWidget.tsx');

// 4. Delete the files
try {
  fs.unlinkSync('src/app/context/GuestContext.tsx');
  console.log('Deleted GuestContext.tsx');
} catch(e) {}

try {
  fs.unlinkSync('src/components/widgets/GuestOnboardingModal.tsx');
  console.log('Deleted GuestOnboardingModal.tsx');
} catch(e) {}

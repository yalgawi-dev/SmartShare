const fs = require('fs');
const file = 'C:/yehuda/project/app/SmartShare/src/components/widgets/Partners/PartnersInviteModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix handleContactSelect whatsappUrl
content = content.replace(
  'const whatsappUrl = \"https://wa.me/$($contact.phone.replace(/\\\\D/g, \\'\\'))?text=$($encodeURIComponent(data.shareText))\";',
  'const whatsappUrl = \\https://wa.me/{contact.phone.replace(/\\\\D/g, \\'\\')}?text={encodeURIComponent(data.shareText)}\\;'
);

// Fix successData whatsappUrl
content = content.replace(
  'const whatsappUrl = \"https://wa.me/$($successData.phone.replace(/\\\\D/g, \\'\\'))?text=$($encodeURIComponent(successData.text))\";',
  'const whatsappUrl = \\https://wa.me/{successData.phone.replace(/\\\\D/g, \\'\\')}?text={encodeURIComponent(successData.text)}\\;'
);

fs.writeFileSync(file, content);

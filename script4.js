const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Partners/PartnersInviteModal.tsx', 'utf8');

const regex = /<label[\s\S]*?<\/label>\s*<input\s*type="text"\s*placeholder="[^"]*"\s*value=\{partnerName\}\s*onChange=\{e => setPartnerName\(e\.target\.value\)\}[\s\S]*?\/>/m;

if (regex.test(c)) {
  c = c.replace(regex, '');
  fs.writeFileSync('src/components/widgets/Partners/PartnersInviteModal.tsx', c);
  console.log('Fixed PartnersInviteModal successfully');
} else {
  console.log('Regex did not match');
}

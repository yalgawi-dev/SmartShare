
const fs = require('fs');
let code = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf8');

if (!code.includes('CreatorDisputesBanner')) {
  code = code.replace(
    'import WelcomeGate from \'../../../components/widgets/Partners/WelcomeGate\';',
    'import WelcomeGate from \'../../../components/widgets/Partners/WelcomeGate\';\nimport CreatorDisputesBanner from \'../../../components/widgets/Partners/CreatorDisputesBanner\';'
  );
  
  code = code.replace(
    '<WelcomeGate spaceId={id} inviteToken={new URLSearchParams(typeof window !== \'undefined\' ? window.location.search : \'\').get(\'invite\')} />',
    '<WelcomeGate spaceId={id} inviteToken={new URLSearchParams(typeof window !== \'undefined\' ? window.location.search : \'\').get(\'invite\')} />\n        <CreatorDisputesBanner space={space} />'
  );
  
  fs.writeFileSync('src/app/space/[id]/page.tsx', code, 'utf8');
}


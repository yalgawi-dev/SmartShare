const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Partners/PartnersInviteModal.tsx', 'utf-8');

c = c.replace(
  'const [isRetroactive, setIsRetroactive] = useState(true);',
  'const [isRetroactive, setIsRetroactive] = useState(false);'
);

fs.writeFileSync('src/components/widgets/Partners/PartnersInviteModal.tsx', c);
console.log('Fixed default retroactive to false');

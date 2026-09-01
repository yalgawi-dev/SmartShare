const fs = require('fs');

const path = 'src/app/space/[id]/settings/page.tsx';
let content = fs.readFileSync(path, 'utf-8');

const regex = /const \{ spaces, updateSpaceSettings, updateMemberPermissions, toggleFeature \} = useSpaces\(\);/;
const replacement = `const { spaces, updateSpaceSettings, updateMemberPermissions, toggleFeature, removeMember, restoreMember } = useSpaces();`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content, 'utf-8');
  console.log('Fixed useSpaces destructuring');
} else {
  console.log('Could not find useSpaces regex');
}

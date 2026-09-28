const fs = require('fs');
const file = 'src/app/settings/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `spaces.filter((s: any) => s.status === 'pending_deletion' && (s as any).creatorId === user?.id).map`;
const replacement1 = `spaces.filter((s: any) => s.status === 'pending_deletion' && (s.creatorId === user?.id || user?.spaceKeys?.[s.id])).map`;

const target2 = `spaces.filter((s: any) => s.status === 'pending_deletion' && (s as any).creatorId === user?.id).length === 0`;
const replacement2 = `spaces.filter((s: any) => s.status === 'pending_deletion' && (s.creatorId === user?.id || user?.spaceKeys?.[s.id])).length === 0`;

if (content.includes(target1) && content.includes(target2)) {
  content = content.replace(target1, replacement1);
  content = content.replace(target2, replacement2);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Patched settings archive logic");
} else {
  console.log("Could not find targets");
}

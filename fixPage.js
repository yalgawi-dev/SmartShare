const fs = require('fs');
let c = fs.readFileSync('src/app/page.tsx', 'utf-8');

const target = "{spaces.filter(s => s.status !== 'pending_deletion').map(space => (";
const replacement = `{spaces.filter(s => { 
          if (s.status === 'pending_deletion') return false; 
          const myId = user?.id || 'anonymous';
          const isCreator = s.createdBy === myId || s.creatorId === myId;
          const isMember = s.members?.some(m => m.userId === myId);
          return isCreator || isMember;
        }).map(space => (`;

if (c.includes(target)) {
  c = c.replace(target, replacement);
  fs.writeFileSync('src/app/page.tsx', c);
  console.log('Replaced successfully.');
} else {
  console.log('Could not find target string in page.tsx');
}

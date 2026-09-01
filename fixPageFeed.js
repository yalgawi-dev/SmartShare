const fs = require('fs');
let c = fs.readFileSync('src/app/page.tsx', 'utf-8');

c = c.replace(
  "const { spaces, deleteSpace } = useSpaces();",
  "const { spaces, deleteSpace, getRoleForSpace } = useSpaces();"
);

c = c.replace(
  /const isCreator = \(s as any\)\.createdBy === myId \|\| \(s as any\)\.creatorId === myId;/,
  `const myRole = getRoleForSpace(s.id);\n          const isCreator = myRole === 'creator';`
);

fs.writeFileSync('src/app/page.tsx', c);
console.log('Fixed page.tsx');

const fs = require('fs');
const file = 'src/components/widgets/Finance/FinanceSummary.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "const myRole = getRoleForSpace(space.id);\n  const isCreatorMe = myRole === 'creator';",
  const myRole = getRoleForSpace(space.id);\n  let isCreatorMe = myRole === 'creator';\n  if (space.creatorId && myId === space.creatorId) isCreatorMe = true;
);

content = content.replace(
  "const creatorId = isCreatorMe ? myId : (space.masterKey ? 'creator_master' : (space.creatorId || space.createdBy || 'creator_unknown'));",
  "const creatorId = space.creatorId || (isCreatorMe ? myId : (space.masterKey ? 'creator_master' : (space.createdBy || 'creator_unknown')));"
);

content = content.replace(
  "const creatorName = isCreatorMe ? myRealName : 'יוצר המרחב';",
  "const creatorName = isCreatorMe ? myRealName : (space.createdBy || 'יוצר המרחב');"
);

fs.writeFileSync(file, content, 'utf8');

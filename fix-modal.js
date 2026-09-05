const fs = require('fs');

const file = 'src/components/widgets/Partners/SharesEditorModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add getRoleForSpace and creator filtering
content = content.replace(
  'const validMembers = (space.members || []).filter((m: any) => m.isActive !== false);',
  const { getRoleForSpace, updateSpaceSettings, removeMember, refreshMemberInvite, updateSharesBulk } = useSpaces();
  const myRole = getRoleForSpace(space.id);
  const isCreatorMe = myRole === 'creator';
  const creatorId = isCreatorMe ? (user?.id || 'me') : (space.creatorId || space.createdBy || 'creator_unknown');
  
  const validMembers = (space.members || []).filter((m: any) => m.isActive !== false && m.userId !== creatorId);
);

// 2. Remove the duplicated useSpaces hook below
content = content.replace(
  'const { updateSpaceSettings, removeMember, refreshMemberInvite, updateSharesBulk } = useSpaces();',
  ''
);

// 3. Fix the top row display name
content = content.replace(
  {user?.name || 'אני'} (אני),
  {isCreatorMe ? (user?.name || 'אני') + ' (אני)' : 'יוצר המרחב'}
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched SharesEditorModal.tsx');
